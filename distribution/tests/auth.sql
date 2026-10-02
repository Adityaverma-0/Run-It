CREATE OR REPLACE FUNCTION distribution.auth_expect_error(statement text,pattern text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%'||pattern||'%' THEN RAISE EXCEPTION 'Wrong auth error: %',SQLERRM; END IF;
    RAISE NOTICE 'PASS: auth rejects %',pattern; RETURN;
  END;
  RAISE EXCEPTION 'Expected auth rejection: %',pattern;
END $$;
DO $$
DECLARE owner_id uuid; staff_id uuid; old_name text;
BEGIN
  SELECT id INTO staff_id FROM distribution.users WHERE email='isolated@example.invalid';
  owner_id:=distribution.auth_owner('owner@example.invalid','Actual test owner','owner-password-hash',false);
  PERFORM distribution.check_true(owner_id IS NOT NULL,'Owner setup creates credentials for the configured owner');
  PERFORM distribution.auth_expect_error($q$SELECT distribution.auth_owner('other@example.invalid','Other','hash',false)$q$,'already configured');
  PERFORM distribution.auth_expect_error($q$SELECT distribution.auth_owner('owner@example.invalid','Other','hash',false)$q$,'already configured');
  PERFORM distribution.check_true(distribution.auth_session('session-1',owner_id,'incorrect') IS NULL,'A stale or incorrect password cannot create a session');
  PERFORM distribution.check_true(distribution.auth_session('session-1',owner_id,'owner-password-hash')=owner_id,'Verified credentials create a session');
  PERFORM distribution.auth_expect_error(format('SELECT distribution.auth_invite(%L,%L,%L)',staff_id,staff_id,'token-1'),'Only the owner');
  PERFORM distribution.auth_expect_error(format('SELECT distribution.auth_invite(%L,%L,%L)',owner_id,owner_id,'token-1'),'active staff');
  PERFORM distribution.auth_invite(owner_id,staff_id,'token-1');
  PERFORM distribution.auth_invite(owner_id,staff_id,'token-2');
  PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.auth_tokens WHERE token_hash='token-1'),'New access links revoke previous links');
  PERFORM distribution.auth_expect_error($q$SELECT distribution.auth_accept('token-2','wrong@example.invalid','new-hash')$q$,'invalid or expired');
  PERFORM distribution.check_true(EXISTS(SELECT 1 FROM distribution.auth_tokens WHERE token_hash='token-2'),'Wrong email cannot consume an access link');
  UPDATE distribution.auth_tokens SET expires_at=now()-interval '1 second' WHERE token_hash='token-2';
  PERFORM distribution.auth_expect_error($q$SELECT distribution.auth_accept('token-2','isolated@example.invalid','new-hash')$q$,'invalid or expired');
  PERFORM distribution.auth_invite(owner_id,staff_id,'token-3');
  PERFORM distribution.check_true(distribution.auth_accept('token-3','isolated@example.invalid','staff-hash')=staff_id,'Staff activation sets credentials for the correct member');
  PERFORM distribution.auth_expect_error($q$SELECT distribution.auth_accept('token-3','isolated@example.invalid','new-hash')$q$,'invalid or expired');
  PERFORM distribution.auth_session('staff-session-1',staff_id,'staff-hash');
  PERFORM distribution.auth_expect_error(format('SELECT distribution.auth_password(%L,%L,%L)',staff_id,'wrong-hash','new-hash'),'Account changed');
  PERFORM distribution.check_true(EXISTS(SELECT 1 FROM distribution.auth_sessions WHERE token_hash='staff-session-1'),'Failed password change preserves sessions');
  PERFORM distribution.auth_password(staff_id,'staff-hash','new-staff-hash');
  PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.auth_sessions WHERE user_id=staff_id),'Password change revokes all previous sessions');
  PERFORM distribution.check_true(distribution.auth_session('stale-session',staff_id,'staff-hash') IS NULL,'A login racing with password reset cannot create an old-password session');
  PERFORM distribution.auth_session('staff-session-2',staff_id,'new-staff-hash');
  PERFORM distribution.auth_invite(owner_id,staff_id,'token-4');
  UPDATE distribution.users SET active=false WHERE id=staff_id;
  PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.auth_sessions WHERE user_id=staff_id) AND NOT EXISTS(SELECT 1 FROM distribution.auth_tokens WHERE user_id=staff_id),'Deactivation revokes sessions and access links');
  PERFORM distribution.check_true(distribution.auth_session('inactive-session',staff_id,'new-staff-hash') IS NULL,'Inactive members cannot start a session');
  UPDATE distribution.users SET active=true WHERE id=staff_id;
  PERFORM distribution.auth_session('staff-session-3',staff_id,'new-staff-hash');
  UPDATE distribution.users SET email='changed@example.invalid' WHERE id=staff_id;
  PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.auth_credentials WHERE user_id=staff_id) AND NOT EXISTS(SELECT 1 FROM distribution.auth_sessions WHERE user_id=staff_id),'Changing email requires fresh activation and revokes old access');
  SELECT name INTO old_name FROM distribution.users WHERE id=owner_id;
  PERFORM distribution.auth_owner('owner@example.invalid','','new-owner-hash',true);
  PERFORM distribution.check_true((SELECT name=old_name FROM distribution.users WHERE id=owner_id),'Owner recovery preserves the owner profile');
  PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.auth_sessions WHERE user_id=owner_id),'Owner recovery signs out previous owner sessions');
  PERFORM distribution.auth_expect_error($q$SELECT distribution.auth_owner('changed@example.invalid','','hash',true)$q$,'unavailable');
  PERFORM distribution.check_true(distribution.auth_limit('test-limit',2),'First login attempt allowed');
  PERFORM distribution.check_true(distribution.auth_limit('test-limit',2),'Second login attempt allowed');
  PERFORM distribution.check_true(NOT distribution.auth_limit('test-limit',2),'Login throttle rejects attempts beyond its limit');
  UPDATE distribution.auth_attempts SET window_start=now()-interval '16 minutes' WHERE key='test-limit';
  PERFORM distribution.check_true(distribution.auth_limit('test-limit',2),'Login throttle resets after its time window');
END $$;
