BEGIN;
CREATE SCHEMA IF NOT EXISTS distribution;
CREATE TABLE IF NOT EXISTS distribution.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL UNIQUE,name text NOT NULL,role text NOT NULL CHECK(role IN ('owner','warehouse_manager','warehouse_staff','sales_manager','salesman','accountant')),active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.settings(id integer PRIMARY KEY CHECK(id=1),business_name text NOT NULL,warehouse_name text NOT NULL DEFAULT 'Central warehouse',address text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',gstin text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.routes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL UNIQUE,area text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sku text NOT NULL UNIQUE,name text NOT NULL,brand text NOT NULL DEFAULT '',category text NOT NULL DEFAULT '',unit text NOT NULL DEFAULT 'Packet',box_size integer NOT NULL DEFAULT 1 CHECK(box_size>0),carton_size integer NOT NULL DEFAULT 1 CHECK(carton_size>0),price numeric(14,2) NOT NULL CHECK(price>=0),cost numeric(14,2) NOT NULL DEFAULT 0 CHECK(cost>=0),tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK(tax_rate>=0 AND tax_rate<=100),min_stock integer NOT NULL DEFAULT 0 CHECK(min_stock>=0),warehouse_qty integer NOT NULL DEFAULT 0 CHECK(warehouse_qty>=0),damaged_qty integer NOT NULL DEFAULT 0 CHECK(damaged_qty>=0),active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,owner_name text NOT NULL DEFAULT '',phone text NOT NULL DEFAULT '',address text NOT NULL DEFAULT '',route_id uuid REFERENCES distribution.routes,credit_limit numeric(14,2) NOT NULL DEFAULT 0 CHECK(credit_limit>=0),balance numeric(14,2) NOT NULL DEFAULT 0 CHECK(balance>=0),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.vehicles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),number text NOT NULL UNIQUE,type text NOT NULL DEFAULT 'Delivery van',salesman_id uuid REFERENCES distribution.users,route_id uuid REFERENCES distribution.routes,status text NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','LOADED','ON ROUTE','RETURNED','RECONCILIATION','CLOSED','MAINTENANCE')),active_day date,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.vehicle_stock(vehicle_id uuid NOT NULL REFERENCES distribution.vehicles,product_id uuid NOT NULL REFERENCES distribution.products,qty integer NOT NULL CHECK(qty>=0),PRIMARY KEY(vehicle_id,product_id));
CREATE TABLE IF NOT EXISTS distribution.vehicle_days(vehicle_id uuid NOT NULL REFERENCES distribution.vehicles,day date NOT NULL,opening jsonb NOT NULL DEFAULT '[]',PRIMARY KEY(vehicle_id,day));
CREATE TABLE IF NOT EXISTS distribution.loads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid NOT NULL REFERENCES distribution.vehicles,salesman_id uuid REFERENCES distribution.users,items jsonb NOT NULL,qty integer NOT NULL CHECK(qty>0),created_by uuid REFERENCES distribution.users,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.sales(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_no bigint GENERATED ALWAYS AS IDENTITY UNIQUE,customer_id uuid NOT NULL REFERENCES distribution.customers,vehicle_id uuid NOT NULL REFERENCES distribution.vehicles,salesman_id uuid REFERENCES distribution.users,items jsonb NOT NULL,subtotal numeric(14,2) NOT NULL CHECK(subtotal>=0),discount numeric(14,2) NOT NULL CHECK(discount>=0),tax numeric(14,2) NOT NULL CHECK(tax>=0),total numeric(14,2) NOT NULL CHECK(total>=0),paid numeric(14,2) NOT NULL CHECK(paid>=0 AND paid<=total),method text NOT NULL CHECK(method IN ('CASH','UPI','CREDIT','BANK TRANSFER')),notes text NOT NULL DEFAULT '',created_by uuid REFERENCES distribution.users,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid NOT NULL REFERENCES distribution.customers,sale_id uuid REFERENCES distribution.sales,amount numeric(14,2) NOT NULL CHECK(amount>0),method text NOT NULL CHECK(method IN ('CASH','UPI','BANK TRANSFER')),reference text NOT NULL DEFAULT '',created_by uuid REFERENCES distribution.users,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.reconciliations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid NOT NULL REFERENCES distribution.vehicles,day date NOT NULL,decision text NOT NULL CHECK(decision IN ('HOLD','UNLOAD')),items jsonb NOT NULL,qty integer NOT NULL CHECK(qty>=0),variance integer NOT NULL DEFAULT 0,notes text NOT NULL DEFAULT '',created_by uuid REFERENCES distribution.users,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(vehicle_id,day));
CREATE TABLE IF NOT EXISTS distribution.movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES distribution.products,vehicle_id uuid REFERENCES distribution.vehicles,kind text NOT NULL CHECK(kind IN ('RECEIPT','LOAD','SALE','UNLOAD','LOSS','DAMAGE')),qty integer NOT NULL,reference_id uuid,notes text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.visits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid NOT NULL REFERENCES distribution.customers,user_id uuid REFERENCES distribution.users,day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(customer_id,user_id,day));
CREATE TABLE IF NOT EXISTS distribution.activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action text NOT NULL,message text NOT NULL,entity_id uuid,created_by uuid REFERENCES distribution.users,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS distribution.notification_reads(user_key text NOT NULL,notification_key text NOT NULL,PRIMARY KEY(user_key,notification_key));
CREATE TABLE IF NOT EXISTS distribution.requests(id uuid PRIMARY KEY,actor_key text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sales_created_idx ON distribution.sales(created_at);
CREATE INDEX IF NOT EXISTS sales_customer_idx ON distribution.sales(customer_id);
CREATE INDEX IF NOT EXISTS payments_created_idx ON distribution.payments(created_at);
CREATE INDEX IF NOT EXISTS movements_created_idx ON distribution.movements(created_at);
CREATE INDEX IF NOT EXISTS activity_created_idx ON distribution.activity(created_at);
CREATE OR REPLACE FUNCTION distribution.apply_action(action text,p jsonb,actor_id uuid,actor_role text,actor_key text,request_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
#variable_conflict use_variable
DECLARE v_id uuid; result jsonb; prev record; v record; prod record; cust record; item jsonb; lines jsonb:='[]'; qty integer; available integer; total_qty integer:=0; subtotal numeric:=0; discount numeric:=0; tax numeric:=0; total numeric:=0; paid numeric:=0; amount numeric; actual integer; diff integer:=0; note text:=coalesce(p->>'notes',''); day_now date:=(now() AT TIME ZONE 'Asia/Kolkata')::date; msg text; allowed boolean:=false; inv_no bigint; old_type record; selected_report_day date; snapshot jsonb; request_payload jsonb:=jsonb_build_object('action',action,'data',p);
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('sanket-distribution-write'));
 SELECT * INTO prev FROM distribution.requests WHERE id=request_id;
 IF FOUND THEN
   IF prev.actor_key<>actor_key OR prev.payload<>request_payload THEN RAISE EXCEPTION 'Request identity conflict'; END IF;
   RETURN prev.result;
 END IF;
 allowed := actor_role='owner' OR
 (actor_role='worker' AND action IN ('product','item_type','vehicle','load','start_day','inventory','sale','payment','vehicle_status','reconcile','submit_daily_report','mark_read')) OR
 (actor_role='warehouse_manager' AND action IN ('product','item_type','vehicle','load','start_day','inventory','vehicle_status','reconcile','mark_read')) OR
 (actor_role='warehouse_staff' AND action IN ('load','start_day','inventory','vehicle_status','mark_read')) OR
 (actor_role='sales_manager' AND action IN ('sale','payment','vehicle_status','reconcile','mark_read')) OR
 (actor_role='salesman' AND action IN ('sale','payment','vehicle_status','reconcile','mark_read')) OR
 (actor_role='accountant' AND action IN ('payment','mark_read'));
 IF NOT allowed THEN RAISE EXCEPTION 'Permission denied for this action'; END IF;
 IF actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM distribution.users WHERE id=actor_id AND role=actor_role AND active) THEN RAISE EXCEPTION 'Session no longer authorized'; END IF;
 IF action='item_type' THEN
  IF p->>'kind' NOT IN ('category','unit') OR length(trim(coalesce(p->>'name',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter an item type name and choose category or unit'; END IF;
  IF nullif(p->>'id','') IS NULL THEN
   INSERT INTO distribution.item_types(kind,name,created_by) VALUES(p->>'kind',trim(p->>'name'),actor_id) RETURNING id INTO v_id;
  ELSE
   SELECT * INTO old_type FROM distribution.item_types WHERE id=(p->>'id')::uuid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Item type not found'; END IF;
   IF old_type.kind<>p->>'kind' THEN RAISE EXCEPTION 'An item type cannot change between category and unit'; END IF;
   UPDATE distribution.item_types SET name=trim(p->>'name') WHERE id=old_type.id RETURNING id INTO v_id;
   IF old_type.kind='category' THEN UPDATE distribution.products SET category=trim(p->>'name') WHERE lower(trim(category))=lower(trim(old_type.name));
   ELSE UPDATE distribution.products SET unit=trim(p->>'name') WHERE lower(trim(unit))=lower(trim(old_type.name)); END IF;
  END IF; msg:='Item type saved: '||trim(p->>'name');
 ELSIF action='submit_daily_report' THEN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Sign in before submitting a daily report'; END IF;
  selected_report_day:=(p->>'day')::date;
  IF selected_report_day IS NULL OR selected_report_day>day_now THEN RAISE EXCEPTION 'Choose today or a previous day for the report'; END IF;
  snapshot:=distribution.daily_summary(selected_report_day);
  INSERT INTO distribution.daily_reports AS dr(report_day,submitted_by,summary,notes) VALUES(selected_report_day,actor_id,snapshot,note)
   ON CONFLICT(report_day,submitted_by) DO UPDATE SET summary=excluded.summary,notes=excluded.notes,revision=dr.revision+1,submitted_at=now(),reviewed_at=NULL,reviewed_by=NULL RETURNING id INTO v_id;
  msg:='Daily report submitted for '||selected_report_day;
 ELSIF action='review_daily_report' THEN
  IF actor_role<>'owner' OR actor_id IS NULL THEN RAISE EXCEPTION 'Only the owner can review reports'; END IF;
  UPDATE distribution.daily_reports SET reviewed_by=actor_id,reviewed_at=now() WHERE id=(p->>'id')::uuid AND revision=(p->>'revision')::integer RETURNING id INTO v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'This report changed. Refresh it before reviewing.'; END IF;
  msg:='Daily report reviewed';
 ELSIF action='product' THEN
  p:=jsonb_set(p,'{category}',to_jsonb(distribution.ensure_item_type('category',p->>'category',actor_id)));
  p:=jsonb_set(p,'{unit}',to_jsonb(distribution.ensure_item_type('unit',p->>'unit',actor_id)));
  IF length(trim(p->>'name'))<1 OR length(trim(p->>'sku'))<1 THEN RAISE EXCEPTION 'Product name and SKU are required'; END IF;
  IF nullif(p->>'id','') IS NULL THEN
   INSERT INTO distribution.products(sku,name,brand,category,unit,box_size,carton_size,price,cost,tax_rate,min_stock) VALUES(upper(trim(p->>'sku')),trim(p->>'name'),coalesce(p->>'brand',''),coalesce(p->>'category',''),coalesce(p->>'unit','Packet'),(p->>'box_size')::integer,(p->>'carton_size')::integer,(p->>'price')::numeric,(p->>'cost')::numeric,(p->>'tax_rate')::numeric,(p->>'min_stock')::integer) RETURNING id INTO v_id;
  ELSE
   UPDATE distribution.products SET sku=upper(trim(p->>'sku')),name=trim(p->>'name'),brand=p->>'brand',category=p->>'category',unit=p->>'unit',box_size=(p->>'box_size')::integer,carton_size=(p->>'carton_size')::integer,price=(p->>'price')::numeric,cost=(p->>'cost')::numeric,tax_rate=(p->>'tax_rate')::numeric,min_stock=(p->>'min_stock')::integer,active=coalesce((p->>'active')::boolean,true) WHERE id=(p->>'id')::uuid RETURNING id INTO v_id;
  END IF; msg:='Product saved: '||(p->>'name');
 ELSIF action='vehicle' THEN
  IF length(trim(p->>'number'))<3 THEN RAISE EXCEPTION 'A valid vehicle number is required'; END IF;
  IF nullif(p->>'salesman_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM distribution.users WHERE id=(p->>'salesman_id')::uuid AND role IN ('salesman','worker') AND active) THEN RAISE EXCEPTION 'Select an active worker or sales representative'; END IF;
  IF nullif(p->>'id','') IS NOT NULL AND EXISTS(SELECT 1 FROM distribution.vehicles WHERE id=(p->>'id')::uuid AND status IN ('ON ROUTE','RETURNED','RECONCILIATION','LOADED')) THEN RAISE EXCEPTION 'Close the current vehicle day before changing assignments'; END IF;
  INSERT INTO distribution.vehicles(id,number,type,salesman_id) VALUES(coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()),upper(trim(p->>'number')),p->>'type',nullif(p->>'salesman_id','')::uuid) ON CONFLICT(id) DO UPDATE SET number=excluded.number,type=excluded.type,salesman_id=excluded.salesman_id,updated_at=now() RETURNING id INTO v_id; msg:='Vehicle saved: '||(p->>'number');
 ELSIF action='user' THEN
  IF actor_role<>'owner' THEN RAISE EXCEPTION 'Only the owner can manage users'; END IF;
  IF p->>'role'='owner' OR EXISTS(SELECT 1 FROM distribution.users WHERE id=nullif(p->>'id','')::uuid AND role='owner') THEN RAISE EXCEPTION 'The owner account cannot be changed here'; END IF;
  IF length(trim(p->>'name'))<1 OR (p->>'email') !~ '^[^ @]+@[^ @]+\.[^ @]+$' THEN RAISE EXCEPTION 'Name and a valid email are required'; END IF;
  INSERT INTO distribution.users(id,email,name,role,active) VALUES(coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()),lower(trim(p->>'email')),trim(p->>'name'),p->>'role',coalesce((p->>'active')::boolean,true)) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role,active=excluded.active RETURNING id INTO v_id; msg:='Team member saved: '||(p->>'name');
 ELSIF action='settings' THEN
  IF length(trim(p->>'business_name'))<1 THEN RAISE EXCEPTION 'Business name is required'; END IF;
  INSERT INTO distribution.settings(id,business_name,warehouse_name,address,phone,gstin) VALUES(1,trim(p->>'business_name'),trim(p->>'warehouse_name'),coalesce(p->>'address',''),coalesce(p->>'phone',''),coalesce(p->>'gstin','')) ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name,warehouse_name=excluded.warehouse_name,address=excluded.address,phone=excluded.phone,gstin=excluded.gstin,updated_at=now(); msg:='Business settings updated';
 ELSIF action='inventory' THEN
  v_id:=(p->>'product_id')::uuid; qty:=(p->>'qty')::integer;
  IF qty<=0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT * INTO prod FROM distribution.products WHERE id=v_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF p->>'kind'='DAMAGE' THEN
   IF length(trim(note))<3 THEN RAISE EXCEPTION 'Describe the damage for the audit trail'; END IF;
   IF prod.warehouse_qty<qty THEN RAISE EXCEPTION 'Insufficient warehouse stock'; END IF;
   UPDATE distribution.products SET warehouse_qty=warehouse_qty-qty,damaged_qty=damaged_qty+qty WHERE id=v_id;
  ELSIF p->>'kind'='RECEIPT' THEN
   UPDATE distribution.products SET warehouse_qty=warehouse_qty+qty WHERE id=v_id;
  ELSE RAISE EXCEPTION 'Select receipt or damage'; END IF;
  INSERT INTO distribution.movements(product_id,kind,qty,notes,created_by) VALUES(v_id,p->>'kind',qty,note,actor_id); msg:=initcap(p->>'kind')||' recorded for '||prod.name;
 ELSIF action IN ('load','start_day','sale','vehicle_status','reconcile') THEN
  SELECT * INTO v FROM distribution.vehicles WHERE id=(p->>'vehicle_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF actor_role='salesman' AND v.salesman_id IS DISTINCT FROM actor_id THEN RAISE EXCEPTION 'This vehicle is not assigned to you'; END IF;
  IF action='start_day' THEN
   IF v.status<>'CLOSED' OR v.active_day>=day_now THEN RAISE EXCEPTION 'Start a new day only after the previous day has closed'; END IF;
   IF NOT EXISTS(SELECT 1 FROM distribution.vehicle_stock vs WHERE vs.vehicle_id=v.id AND vs.qty>0) THEN RAISE EXCEPTION 'Load stock before starting a new day'; END IF;
   INSERT INTO distribution.vehicle_days(vehicle_id,day,opening) SELECT v.id,day_now,coalesce(jsonb_agg(jsonb_build_object('product_id',vs.product_id,'qty',vs.qty)),'[]') FROM distribution.vehicle_stock vs WHERE vs.vehicle_id=v.id ON CONFLICT DO NOTHING;
   UPDATE distribution.vehicles SET status='LOADED',active_day=day_now,updated_at=now() WHERE id=v.id; v_id:=v.id;msg:='Opening held stock confirmed for '||v.number;
  ELSIF action='load' THEN
   IF v.status IN ('MAINTENANCE','ON ROUTE','RETURNED','RECONCILIATION') OR (v.status='CLOSED' AND v.active_day=day_now) THEN RAISE EXCEPTION 'This vehicle is not available for loading'; END IF;
   IF v.active_day<day_now AND v.status<>'CLOSED' THEN RAISE EXCEPTION 'Reconcile the previous vehicle day before loading'; END IF;
   IF v.salesman_id IS NULL OR NOT EXISTS(SELECT 1 FROM distribution.users WHERE id=v.salesman_id AND role IN ('salesman','worker') AND active) THEN RAISE EXCEPTION 'Assign an active worker or sales representative before loading'; END IF;
   INSERT INTO distribution.vehicle_days(vehicle_id,day,opening) SELECT v.id,day_now,coalesce(jsonb_agg(jsonb_build_object('product_id',vs.product_id,'qty',vs.qty)),'[]') FROM distribution.vehicle_stock vs WHERE vs.vehicle_id=v.id ON CONFLICT DO NOTHING;
   IF jsonb_typeof(p->'items')<>'array' OR jsonb_array_length(p->'items')=0 THEN RAISE EXCEPTION 'Add at least one product'; END IF;
   v_id:=gen_random_uuid();
   FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    qty:=(item->>'qty')::integer;
    SELECT * INTO prod FROM distribution.products WHERE id=(item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND OR NOT prod.active THEN RAISE EXCEPTION 'Product not available'; END IF;
    IF qty<=0 OR prod.warehouse_qty<qty THEN RAISE EXCEPTION 'Insufficient warehouse stock for %',prod.name; END IF;
    UPDATE distribution.products SET warehouse_qty=warehouse_qty-qty WHERE id=prod.id;
    INSERT INTO distribution.vehicle_stock(vehicle_id,product_id,qty) VALUES(v.id,prod.id,qty) ON CONFLICT(vehicle_id,product_id) DO UPDATE SET qty=distribution.vehicle_stock.qty+excluded.qty;
    INSERT INTO distribution.movements(product_id,vehicle_id,kind,qty,reference_id,created_by) VALUES(prod.id,v.id,'LOAD',qty,v_id,actor_id);
    total_qty:=total_qty+qty; lines:=lines||jsonb_build_array(jsonb_build_object('product_id',prod.id,'name',prod.name,'qty',qty,'unit',prod.unit));
   END LOOP;
   INSERT INTO distribution.loads(id,vehicle_id,salesman_id,items,qty,created_by) VALUES(v_id,v.id,v.salesman_id,lines,total_qty,actor_id);
   UPDATE distribution.vehicles SET status='LOADED',active_day=day_now,updated_at=now() WHERE id=v.id; msg:='Load confirmed for '||v.number;
  ELSIF action='vehicle_status' THEN
   IF NOT ((v.status='LOADED' AND p->>'status'='ON ROUTE' AND v.active_day=day_now) OR (v.status='ON ROUTE' AND p->>'status'='RETURNED') OR (v.status='RETURNED' AND p->>'status'='RECONCILIATION') OR (v.status IN ('AVAILABLE','CLOSED') AND p->>'status'='MAINTENANCE' AND NOT EXISTS(SELECT 1 FROM distribution.vehicle_stock vs WHERE vs.vehicle_id=v.id AND vs.qty>0)) OR (v.status='MAINTENANCE' AND p->>'status'='AVAILABLE')) THEN RAISE EXCEPTION 'This status change is not permitted'; END IF;
   UPDATE distribution.vehicles SET status=p->>'status',updated_at=now() WHERE id=v.id; v_id:=v.id; msg:=v.number||' · '||(p->>'status');
  ELSIF action='sale' THEN
   IF v.status<>'ON ROUTE' OR v.active_day<>day_now THEN RAISE EXCEPTION 'Sales require a vehicle dispatched today'; END IF;
   IF (nullif(p->>'customer_id','') IS NOT NULL) = (p->'buyer' IS NOT NULL AND p->'buyer'<>'null'::jsonb) THEN RAISE EXCEPTION 'Choose an existing buyer or enter a new buyer'; END IF;
   IF (p ? 'buyer_credit_limit' OR p ? 'buyer_salesman_id') AND actor_role NOT IN ('owner','worker','sales_manager') THEN RAISE EXCEPTION 'Only an owner, worker or sales manager can change buyer credit or access'; END IF;
   IF nullif(p->>'customer_id','') IS NULL THEN
    IF length(trim(coalesce(p->'buyer'->>'name',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter the actual buyer name'; END IF;
    INSERT INTO distribution.customers(name,phone,address)
     VALUES(trim(p->'buyer'->>'name'),coalesce(p->'buyer'->>'phone',''),coalesce(p->'buyer'->>'address','')) RETURNING * INTO cust;
    IF actor_role='salesman' THEN
     INSERT INTO distribution.buyer_access(customer_id,user_id,granted_by) VALUES(cust.id,actor_id,actor_id);
    END IF;
   ELSE
    SELECT * INTO cust FROM distribution.customers WHERE id=(p->>'customer_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Buyer not found'; END IF;
   END IF;
   IF p ? 'buyer_credit_limit' THEN
    IF (p->>'buyer_credit_limit')::numeric IS NULL OR (p->>'buyer_credit_limit')::numeric<0 THEN RAISE EXCEPTION 'Credit limit must be non-negative'; END IF;
    UPDATE distribution.customers SET credit_limit=(p->>'buyer_credit_limit')::numeric WHERE id=cust.id RETURNING * INTO cust;
   END IF;
   IF p ? 'buyer_salesman_id' THEN
    IF NOT EXISTS(SELECT 1 FROM distribution.users WHERE id=(p->>'buyer_salesman_id')::uuid AND role='salesman' AND active) THEN RAISE EXCEPTION 'Choose an active sales representative'; END IF;
    INSERT INTO distribution.buyer_access(customer_id,user_id,granted_by) VALUES(cust.id,(p->>'buyer_salesman_id')::uuid,actor_id) ON CONFLICT DO NOTHING;
   END IF;
   IF actor_role='salesman' AND NOT EXISTS(SELECT 1 FROM distribution.buyer_access WHERE customer_id=cust.id AND user_id=actor_id) THEN RAISE EXCEPTION 'This buyer is not assigned to you'; END IF;
   IF jsonb_typeof(p->'items')<>'array' OR jsonb_array_length(p->'items')=0 THEN RAISE EXCEPTION 'Add at least one product'; END IF;
   v_id:=gen_random_uuid();
   FOR item IN SELECT value FROM jsonb_array_elements(p->'items') LOOP
    qty:=(item->>'qty')::integer;
    SELECT * INTO prod FROM distribution.products WHERE id=(item->>'product_id')::uuid AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
    SELECT s.qty INTO available FROM distribution.vehicle_stock s WHERE vehicle_id=v.id AND product_id=prod.id FOR UPDATE;
    IF qty<=0 OR coalesce(available,0)<qty THEN RAISE EXCEPTION 'Insufficient vehicle stock for %',prod.name; END IF;
    amount:=round(prod.price*qty,2); subtotal:=subtotal+amount;
    lines:=lines||jsonb_build_array(jsonb_build_object('product_id',prod.id,'name',prod.name,'qty',qty,'unit',prod.unit,'price',prod.price,'tax_rate',prod.tax_rate,'subtotal',amount));
    UPDATE distribution.vehicle_stock SET qty=vehicle_stock.qty-qty WHERE vehicle_id=v.id AND product_id=prod.id;
    INSERT INTO distribution.movements(product_id,vehicle_id,kind,qty,reference_id,created_by) VALUES(prod.id,v.id,'SALE',qty,v_id,actor_id);
   END LOOP;
   discount:=coalesce((p->>'discount')::numeric,0);
   IF discount<0 OR discount>subtotal THEN RAISE EXCEPTION 'Discount must be between zero and subtotal'; END IF;
   SELECT coalesce(sum(round((x->>'subtotal')::numeric * (CASE WHEN subtotal>0 THEN (subtotal-discount)/subtotal ELSE 0 END) * (x->>'tax_rate')::numeric/100,2)),0) INTO tax FROM jsonb_array_elements(lines) x;
   total:=round(subtotal-discount+tax,2); paid:=coalesce((p->>'paid')::numeric,0);
   IF paid<0 OR paid>total THEN RAISE EXCEPTION 'Payment cannot exceed sale total'; END IF;
   IF p->>'method'='CREDIT' AND paid<>0 THEN RAISE EXCEPTION 'Credit sales must have zero paid amount'; END IF;
   IF cust.balance+total-paid>cust.credit_limit THEN RAISE EXCEPTION 'Customer credit limit exceeded'; END IF;
   INSERT INTO distribution.sales(id,customer_id,vehicle_id,salesman_id,items,subtotal,discount,tax,total,paid,method,notes,created_by) VALUES(v_id,cust.id,v.id,v.salesman_id,lines,subtotal,discount,tax,total,paid,p->>'method',note,actor_id) RETURNING invoice_no INTO inv_no;
   UPDATE distribution.customers SET balance=balance+total-paid WHERE id=cust.id;
   IF paid>0 THEN INSERT INTO distribution.payments(customer_id,sale_id,amount,method,reference,created_by) VALUES(cust.id,v_id,paid,p->>'method',coalesce(p->>'reference',''),actor_id); END IF;
   msg:='Sale INV-'||lpad(inv_no::text,6,'0')||' recorded for '||cust.name;
  ELSIF action='reconcile' THEN
   IF v.active_day IS NULL OR v.status NOT IN ('LOADED','ON ROUTE','RETURNED','RECONCILIATION') THEN RAISE EXCEPTION 'No open vehicle day to reconcile'; END IF;
   IF p->>'decision' NOT IN ('HOLD','UNLOAD') THEN RAISE EXCEPTION 'Choose HOLD or UNLOAD'; END IF;
   IF EXISTS(SELECT 1 FROM distribution.reconciliations WHERE vehicle_id=v.id AND day=v.active_day) THEN RAISE EXCEPTION 'This vehicle day is already closed'; END IF;
   IF (SELECT count(*) FROM jsonb_array_elements(p->'items'))<>(SELECT count(*) FROM distribution.vehicle_stock WHERE vehicle_id=v.id AND vehicle_stock.qty>0) OR (SELECT count(DISTINCT x->>'product_id') FROM jsonb_array_elements(p->'items') x)<>(SELECT count(*) FROM jsonb_array_elements(p->'items')) THEN RAISE EXCEPTION 'Count every remaining product exactly once'; END IF;
   v_id:=gen_random_uuid();
   FOR prod IN SELECT s.*,p2.name,p2.unit FROM distribution.vehicle_stock s JOIN distribution.products p2 ON p2.id=s.product_id WHERE s.vehicle_id=v.id AND s.qty>0 FOR UPDATE OF s LOOP
    SELECT (x->>'physical')::integer INTO actual FROM jsonb_array_elements(p->'items') x WHERE (x->>'product_id')::uuid=prod.product_id;
    IF actual IS NULL OR actual<0 OR actual>prod.qty THEN RAISE EXCEPTION 'Physical count must be between zero and expected stock for %',prod.name; END IF;
    IF actual<>prod.qty AND (actor_role NOT IN ('owner','warehouse_manager','worker') OR length(trim(note))<3) THEN RAISE EXCEPTION 'A manager must record a reason for stock discrepancies'; END IF;
    diff:=diff+prod.qty-actual;
    IF actual<prod.qty THEN INSERT INTO distribution.movements(product_id,vehicle_id,kind,qty,reference_id,notes,created_by) VALUES(prod.product_id,v.id,'LOSS',prod.qty-actual,v_id,note,actor_id); END IF;
    IF p->>'decision'='UNLOAD' THEN
     UPDATE distribution.products SET warehouse_qty=warehouse_qty+actual WHERE id=prod.product_id;
     UPDATE distribution.vehicle_stock SET qty=0 WHERE vehicle_id=v.id AND product_id=prod.product_id;
     IF actual>0 THEN INSERT INTO distribution.movements(product_id,vehicle_id,kind,qty,reference_id,created_by) VALUES(prod.product_id,v.id,'UNLOAD',actual,v_id,actor_id); END IF;
    ELSE UPDATE distribution.vehicle_stock SET qty=actual WHERE vehicle_id=v.id AND product_id=prod.product_id; END IF;
    total_qty:=total_qty+actual; lines:=lines||jsonb_build_array(jsonb_build_object('product_id',prod.product_id,'name',prod.name,'expected',prod.qty,'physical',actual));
   END LOOP;
   INSERT INTO distribution.reconciliations(id,vehicle_id,day,decision,items,qty,variance,notes,created_by) VALUES(v_id,v.id,v.active_day,p->>'decision',lines,total_qty,diff,note,actor_id);
   UPDATE distribution.vehicles SET status='CLOSED',updated_at=now() WHERE id=v.id; msg:=v.number||' closed · '||(p->>'decision');
  END IF;
 ELSIF action='payment' THEN
  SELECT * INTO cust FROM distribution.customers WHERE id=(p->>'customer_id')::uuid FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Buyer not found'; END IF;
  IF actor_role='salesman' AND NOT EXISTS(SELECT 1 FROM distribution.buyer_access WHERE customer_id=cust.id AND user_id=actor_id) THEN RAISE EXCEPTION 'This buyer is not assigned to you'; END IF;
  amount:=(p->>'amount')::numeric;
  IF amount<=0 OR amount>cust.balance THEN RAISE EXCEPTION 'Payment must be positive and cannot exceed outstanding balance'; END IF;
  INSERT INTO distribution.payments(customer_id,amount,method,reference,created_by) VALUES(cust.id,amount,p->>'method',coalesce(p->>'reference',''),actor_id) RETURNING id INTO v_id;
  UPDATE distribution.customers SET balance=balance-amount WHERE id=cust.id;
  paid:=amount;
  FOR v IN SELECT id,sales.total,sales.paid FROM distribution.sales WHERE customer_id=cust.id AND sales.paid<sales.total ORDER BY created_at,id FOR UPDATE LOOP
   subtotal:=least(paid,v.total-v.paid); UPDATE distribution.sales SET paid=sales.paid+subtotal WHERE id=v.id; paid:=paid-subtotal; EXIT WHEN paid<=0;
  END LOOP; msg:='Payment received from '||cust.name;
 ELSIF action='mark_read' THEN
  INSERT INTO distribution.notification_reads(user_key,notification_key) SELECT actor_key,jsonb_array_elements_text(p->'keys') ON CONFLICT DO NOTHING; msg:='Notifications marked as read';
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 IF action NOT IN ('settings','mark_read') AND v_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
 IF action<>'mark_read' THEN INSERT INTO distribution.activity(action,message,entity_id,created_by) VALUES(action,msg,v_id,actor_id); END IF;
 result:=jsonb_build_object('id',v_id,'message',msg);
 INSERT INTO distribution.requests(id,actor_key,payload,result) VALUES(request_id,actor_key,request_payload,result);
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION distribution.resolve_member(member_email text,member_name text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE u distribution.users;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('sanket-distribution-write'));
 IF NOT EXISTS(SELECT 1 FROM distribution.users WHERE role='owner') THEN INSERT INTO distribution.users(email,name,role) VALUES(lower(member_email),member_name,'owner') ON CONFLICT(email) DO UPDATE SET role='owner',name=excluded.name,active=true; END IF;
 SELECT * INTO u FROM distribution.users WHERE email=lower(member_email) AND active;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN to_jsonb(u);
END $$;
COMMIT;
