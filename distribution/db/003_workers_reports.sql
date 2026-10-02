BEGIN;
ALTER TABLE distribution.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE distribution.users ADD CONSTRAINT users_role_check CHECK(role IN ('owner','worker','warehouse_manager','warehouse_staff','sales_manager','salesman','accountant'));
ALTER TABLE distribution.movements ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES distribution.users(id);
UPDATE distribution.movements m SET created_by=l.created_by FROM distribution.loads l WHERE m.kind='LOAD' AND m.reference_id=l.id AND m.created_by IS NULL;
UPDATE distribution.movements m SET created_by=s.created_by FROM distribution.sales s WHERE m.kind='SALE' AND m.reference_id=s.id AND m.created_by IS NULL;
UPDATE distribution.movements m SET created_by=r.created_by FROM distribution.reconciliations r WHERE m.kind IN ('UNLOAD','LOSS') AND m.reference_id=r.id AND m.created_by IS NULL;

CREATE TABLE IF NOT EXISTS distribution.item_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('category','unit')),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 500),
 created_by uuid REFERENCES distribution.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS item_types_name_idx ON distribution.item_types(kind,lower(trim(name)));
-- Preserve real catalogue values; no example categories or units are seeded.
INSERT INTO distribution.item_types(kind,name) SELECT 'category',trim(category) FROM distribution.products WHERE trim(category)<>'' GROUP BY trim(category) ON CONFLICT DO NOTHING;
INSERT INTO distribution.item_types(kind,name) SELECT 'unit',trim(unit) FROM distribution.products WHERE trim(unit)<>'' GROUP BY trim(unit) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION distribution.ensure_item_type(p_kind text,p_name text,p_actor uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE canonical text;
BEGIN
 IF p_kind='category' AND trim(coalesce(p_name,''))='' THEN RETURN ''; END IF;
 IF p_kind NOT IN ('category','unit') OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Item types must contain 1 to 500 characters'; END IF;
 INSERT INTO distribution.item_types(kind,name,created_by) VALUES(p_kind,trim(p_name),p_actor) ON CONFLICT DO NOTHING;
 SELECT name INTO canonical FROM distribution.item_types WHERE kind=p_kind AND lower(trim(name))=lower(trim(p_name));
 RETURN canonical;
END $$;

CREATE TABLE IF NOT EXISTS distribution.daily_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 report_day date NOT NULL,
 submitted_by uuid NOT NULL REFERENCES distribution.users(id),
 revision integer NOT NULL DEFAULT 1,
 summary jsonb NOT NULL,
 notes text NOT NULL DEFAULT '',
 submitted_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES distribution.users(id),
 reviewed_at timestamptz,
 UNIQUE(report_day,submitted_by)
);
CREATE INDEX IF NOT EXISTS daily_reports_day_idx ON distribution.daily_reports(report_day DESC);

CREATE OR REPLACE FUNCTION distribution.daily_summary(p_day date) RETURNS jsonb LANGUAGE sql STABLE AS $$
WITH bounds AS (
 SELECT p_day::timestamp AT TIME ZONE 'Asia/Kolkata' AS start_at,(p_day+1)::timestamp AT TIME ZONE 'Asia/Kolkata' AS end_at
), ledger AS (
 SELECT m.*,
 CASE WHEN kind IN ('RECEIPT','UNLOAD') THEN qty WHEN kind IN ('LOAD','DAMAGE') THEN -qty ELSE 0 END AS warehouse_delta,
 CASE WHEN kind='LOAD' THEN qty WHEN kind IN ('SALE','UNLOAD','LOSS') THEN -qty ELSE 0 END AS vehicle_delta
 FROM distribution.movements m
), changes AS (
 SELECT p.id,p.sku,p.name,p.category,p.unit,
 p.warehouse_qty-coalesce(sum(m.warehouse_delta) FILTER(WHERE m.created_at>=b.end_at),0) AS closing_warehouse,
 coalesce((SELECT sum(vs.qty) FROM distribution.vehicle_stock vs WHERE vs.product_id=p.id),0)-coalesce(sum(m.vehicle_delta) FILTER(WHERE m.created_at>=b.end_at),0) AS closing_vehicle,
 coalesce(sum(m.warehouse_delta) FILTER(WHERE m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS warehouse_change,
 coalesce(sum(m.vehicle_delta) FILTER(WHERE m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS vehicle_change,
 coalesce(sum(m.qty) FILTER(WHERE m.kind='RECEIPT' AND m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS received,
 coalesce(sum(m.qty) FILTER(WHERE m.kind='LOAD' AND m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS loaded,
 coalesce(sum(m.qty) FILTER(WHERE m.kind='SALE' AND m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS sold,
 coalesce(sum(m.qty) FILTER(WHERE m.kind='UNLOAD' AND m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS unloaded,
 coalesce(sum(m.qty) FILTER(WHERE m.kind='DAMAGE' AND m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS damaged,
 coalesce(sum(m.qty) FILTER(WHERE m.kind='LOSS' AND m.created_at>=b.start_at AND m.created_at<b.end_at),0) AS lost
 FROM distribution.products p CROSS JOIN bounds b LEFT JOIN ledger m ON m.product_id=p.id
 WHERE p.created_at<b.end_at
 GROUP BY p.id,b.start_at,b.end_at
), stock AS (
 SELECT id,sku,name,category,unit,closing_warehouse-warehouse_change AS opening_warehouse,
 closing_vehicle-vehicle_change AS opening_vehicle,received,loaded,sold,unloaded,damaged,lost,closing_warehouse,closing_vehicle
 FROM changes
), sales AS (
 SELECT s.id,s.invoice_no,s.total,s.created_at,u.name AS recorded_by,c.name AS customer_name,v.number AS vehicle_number
 FROM distribution.sales s CROSS JOIN bounds b LEFT JOIN distribution.users u ON u.id=s.created_by
 JOIN distribution.customers c ON c.id=s.customer_id JOIN distribution.vehicles v ON v.id=s.vehicle_id
 WHERE s.created_at>=b.start_at AND s.created_at<b.end_at
), workers AS (
 SELECT u.id,u.name,u.role,
 (SELECT count(*) FROM distribution.sales s WHERE s.created_by=u.id AND s.created_at>=b.start_at AND s.created_at<b.end_at) AS orders,
 (SELECT coalesce(sum(s.total),0) FROM distribution.sales s WHERE s.created_by=u.id AND s.created_at>=b.start_at AND s.created_at<b.end_at) AS sales,
 (SELECT coalesce(sum(p.amount),0) FROM distribution.payments p WHERE p.created_by=u.id AND p.created_at>=b.start_at AND p.created_at<b.end_at) AS collections,
 (SELECT coalesce(sum(m.qty),0) FROM ledger m WHERE m.created_by=u.id AND m.kind='RECEIPT' AND m.created_at>=b.start_at AND m.created_at<b.end_at) AS received,
 (SELECT coalesce(sum(m.qty),0) FROM ledger m WHERE m.created_by=u.id AND m.kind='LOAD' AND m.created_at>=b.start_at AND m.created_at<b.end_at) AS loaded,
 (SELECT coalesce(sum(m.qty),0) FROM ledger m WHERE m.created_by=u.id AND m.kind='SALE' AND m.created_at>=b.start_at AND m.created_at<b.end_at) AS sold,
 (SELECT count(*) FROM distribution.activity a WHERE a.created_by=u.id AND a.created_at>=b.start_at AND a.created_at<b.end_at AND a.action NOT IN ('account','submit_daily_report','review_daily_report')) AS updates
 FROM distribution.users u CROSS JOIN bounds b
)
SELECT jsonb_build_object(
 'day',p_day,'generated_at',now(),
 'totals',jsonb_build_object(
   'orders',(SELECT count(*) FROM sales),'sales',(SELECT coalesce(sum(total),0) FROM sales),
   'collections',(SELECT coalesce(sum(p.amount),0) FROM distribution.payments p CROSS JOIN bounds b WHERE p.created_at>=b.start_at AND p.created_at<b.end_at),
   'received',(SELECT coalesce(sum(received),0) FROM stock),'loaded',(SELECT coalesce(sum(loaded),0) FROM stock),'sold',(SELECT coalesce(sum(sold),0) FROM stock),
   'warehouse',(SELECT coalesce(sum(closing_warehouse),0) FROM stock),'vehicles',(SELECT coalesce(sum(closing_vehicle),0) FROM stock),
   'loss',(SELECT coalesce(sum(damaged+lost),0) FROM stock)
 ),
 'stock',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM stock s),'[]'::jsonb),
 'sales',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC) FROM sales s),'[]'::jsonb),
 'workers',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.name) FROM workers w WHERE w.updates>0 OR w.orders>0 OR w.collections>0 OR w.received>0 OR w.loaded>0 OR w.sold>0),'[]'::jsonb)
);
$$;
COMMIT;
