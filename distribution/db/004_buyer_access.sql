BEGIN;
-- Keep legacy routes/customer references for historical records. New operations
-- authorize representatives through explicit buyer assignments, not routes.
CREATE TABLE IF NOT EXISTS distribution.buyer_access (
 customer_id uuid NOT NULL REFERENCES distribution.customers(id),
 user_id uuid NOT NULL REFERENCES distribution.users(id),
 granted_by uuid REFERENCES distribution.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(customer_id,user_id)
);
CREATE INDEX IF NOT EXISTS buyer_access_user_idx ON distribution.buyer_access(user_id,customer_id);
CREATE TABLE IF NOT EXISTS distribution.schema_migrations (
 version text PRIMARY KEY,
 applied_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM distribution.schema_migrations WHERE version='004_buyer_access') THEN
  -- Freeze only access that already exists. Never re-grant it on later startups.
  INSERT INTO distribution.buyer_access(customer_id,user_id)
   SELECT DISTINCT c.id,v.salesman_id FROM distribution.customers c
   JOIN distribution.vehicles v ON v.route_id=c.route_id
   JOIN distribution.users u ON u.id=v.salesman_id
   WHERE u.role='salesman' AND u.active
   ON CONFLICT DO NOTHING;
  INSERT INTO distribution.schema_migrations(version) VALUES('004_buyer_access');
 END IF;
END $$;
COMMIT;
