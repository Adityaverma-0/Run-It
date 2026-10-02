BEGIN;
CREATE TABLE IF NOT EXISTS distribution.auth_credentials (
  user_id uuid PRIMARY KEY REFERENCES distribution.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS distribution.auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES distribution.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON distribution.auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON distribution.auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS distribution.auth_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES distribution.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS distribution.auth_attempts (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION distribution.auth_session(p_token text,p_user uuid,p_hash text) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sanket-distribution-write'));
  IF NOT EXISTS(SELECT 1 FROM distribution.users u JOIN distribution.auth_credentials c ON c.user_id=u.id WHERE u.id=p_user AND u.active AND c.password_hash=p_hash) THEN RETURN NULL; END IF;
  INSERT INTO distribution.auth_sessions(token_hash,user_id,expires_at) VALUES(p_token,p_user,now()+interval '7 days');
  RETURN p_user;
END $$;

CREATE OR REPLACE FUNCTION distribution.auth_limit(p_key text, p_limit integer) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO distribution.auth_attempts AS a(key,attempts) VALUES(p_key,1)
  ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN a.window_start < now()-interval '15 minutes' THEN 1 ELSE a.attempts+1 END,
    window_start=CASE WHEN a.window_start < now()-interval '15 minutes' THEN now() ELSE a.window_start END
  RETURNING attempts INTO n;
  DELETE FROM distribution.auth_attempts WHERE window_start < now()-interval '1 day';
  DELETE FROM distribution.auth_sessions WHERE expires_at < now();
  DELETE FROM distribution.auth_tokens WHERE expires_at < now();
  RETURN n<=p_limit;
END $$;

-- Only the server calls this after validating the configured owner email and setup secret.
CREATE OR REPLACE FUNCTION distribution.auth_owner(p_email text,p_name text,p_hash text,p_recover boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE u distribution.users; uid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sanket-distribution-write'));
  SELECT * INTO u FROM distribution.users WHERE lower(email)=p_email FOR UPDATE;
  IF p_recover THEN
    IF u.id IS NULL OR u.role<>'owner' THEN RAISE EXCEPTION 'Owner recovery is unavailable for this email'; END IF;
    UPDATE distribution.users SET active=true WHERE id=u.id;
  ELSE
    IF EXISTS(SELECT 1 FROM distribution.users WHERE role='owner' AND id IS DISTINCT FROM u.id)
      OR EXISTS(SELECT 1 FROM distribution.auth_credentials WHERE user_id=u.id)
    THEN RAISE EXCEPTION 'Owner already configured. Sign in or use owner recovery.'; END IF;
    IF u.id IS NULL THEN
      INSERT INTO distribution.users(email,name,role) VALUES(p_email,p_name,'owner') RETURNING id INTO uid;
    ELSE
      UPDATE distribution.users SET role='owner',name=p_name,active=true WHERE id=u.id;
    END IF;
  END IF;
  uid:=coalesce(uid,u.id);
  INSERT INTO distribution.auth_credentials(user_id,password_hash) VALUES(uid,p_hash)
    ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=now();
  DELETE FROM distribution.auth_sessions WHERE user_id=uid;
  DELETE FROM distribution.auth_tokens WHERE user_id=uid;
  INSERT INTO distribution.activity(action,message,created_by) VALUES('account',CASE WHEN p_recover THEN 'Owner access recovered' ELSE 'Owner account configured' END,uid);
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION distribution.auth_invite(p_actor uuid,p_user uuid,p_token text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE u distribution.users;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sanket-distribution-write'));
  IF NOT EXISTS(SELECT 1 FROM distribution.users WHERE id=p_actor AND role='owner' AND active) THEN RAISE EXCEPTION 'Only the owner can manage access'; END IF;
  SELECT * INTO u FROM distribution.users WHERE id=p_user AND active AND role<>'owner' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select an active staff account'; END IF;
  DELETE FROM distribution.auth_tokens WHERE user_id=p_user;
  INSERT INTO distribution.auth_tokens(token_hash,user_id,email,expires_at) VALUES(p_token,p_user,u.email,now()+interval '24 hours');
  INSERT INTO distribution.activity(action,message,created_by) VALUES('account','Created account access link for '||u.name,p_actor);
END $$;

CREATE OR REPLACE FUNCTION distribution.auth_accept(p_token text,p_email text,p_hash text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE t distribution.auth_tokens;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sanket-distribution-write'));
  DELETE FROM distribution.auth_tokens WHERE token_hash=p_token AND email=p_email AND expires_at>now() RETURNING * INTO t;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM distribution.users WHERE id=t.user_id AND email=t.email AND active AND role<>'owner') THEN
    RAISE EXCEPTION 'This access link is invalid or expired. Ask the owner for a new link.';
  END IF;
  INSERT INTO distribution.auth_credentials(user_id,password_hash) VALUES(t.user_id,p_hash)
    ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=now();
  DELETE FROM distribution.auth_sessions WHERE user_id=t.user_id;
  INSERT INTO distribution.activity(action,message,created_by) VALUES('account','Account password set with an access link',t.user_id);
  RETURN t.user_id;
END $$;

CREATE OR REPLACE FUNCTION distribution.auth_password(p_user uuid,p_old text,p_new text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sanket-distribution-write'));
  UPDATE distribution.auth_credentials c SET password_hash=p_new,updated_at=now()
    WHERE c.user_id=p_user AND c.password_hash=p_old AND EXISTS(SELECT 1 FROM distribution.users WHERE id=p_user AND active);
  IF NOT FOUND THEN RAISE EXCEPTION 'Account changed. Sign in again before changing your password.'; END IF;
  DELETE FROM distribution.auth_sessions WHERE user_id=p_user;
  DELETE FROM distribution.auth_tokens WHERE user_id=p_user;
  INSERT INTO distribution.activity(action,message,created_by) VALUES('account','Account password changed',p_user);
END $$;

CREATE OR REPLACE FUNCTION distribution.auth_revoke_on_user_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email OR NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active THEN
    DELETE FROM distribution.auth_sessions WHERE user_id=NEW.id;
    DELETE FROM distribution.auth_tokens WHERE user_id=NEW.id;
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    DELETE FROM distribution.auth_credentials WHERE user_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS auth_revoke_on_user_change ON distribution.users;
CREATE TRIGGER auth_revoke_on_user_change AFTER UPDATE ON distribution.users FOR EACH ROW EXECUTE FUNCTION distribution.auth_revoke_on_user_change();
COMMIT;
