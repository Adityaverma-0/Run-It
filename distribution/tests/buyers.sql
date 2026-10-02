DO $$
#variable_conflict use_variable
DECLARE owner_id uuid; rep uuid; other_rep uuid; legacy_buyer uuid; p_id uuid; vehicle uuid; other_vehicle uuid; buyer_id uuid; new_id uuid; sale_id uuid; req uuid; payload jsonb; result jsonb; before_count bigint; before_qty integer;
BEGIN
 SELECT id INTO owner_id FROM distribution.users WHERE email='owner@example.invalid';
 SELECT id INTO rep FROM distribution.users WHERE email='legacy-rep@example.invalid';
 SELECT id INTO other_rep FROM distribution.users WHERE email='unassigned-rep@example.invalid';
 SELECT id INTO legacy_buyer FROM distribution.customers WHERE name='Preserved legacy buyer';
 PERFORM distribution.check_true(EXISTS(SELECT 1 FROM distribution.buyer_access WHERE customer_id=legacy_buyer AND user_id=rep),'Migration preserves existing representative buyer access');
 PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.buyer_access WHERE user_id=other_rep),'Migration grants no access to an unassigned representative');
 PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.buyer_access a JOIN distribution.customers c ON c.id=a.customer_id WHERE c.name='Unassigned legacy buyer'),'Migration does not expose buyers without a route assignment');
 PERFORM distribution.check_true((SELECT balance=40 AND credit_limit=100 AND phone='legacy-phone' FROM distribution.customers WHERE id=legacy_buyer),'Migration preserves buyer identity, balances and credit limits');
 PERFORM distribution.check_true((SELECT total=50 AND paid=10 FROM distribution.sales WHERE customer_id=legacy_buyer),'Migration preserves historical invoices');
 SELECT r.payload->'data' INTO payload FROM distribution.requests r WHERE r.id='00000000-0000-4000-8000-000000000004';
 result:=distribution.apply_action('payment',payload,rep,'salesman',rep::text,'00000000-0000-4000-8000-000000000004');
 PERFORM distribution.check_true(result->>'message'='Previously confirmed' AND (SELECT balance=40 FROM distribution.customers WHERE id=legacy_buyer),'Old queued payment UUID replays without another collection');
 PERFORM distribution.expect_error('route','{}','owner','Unknown action');
 PERFORM distribution.expect_error('customer','{}','owner','Unknown action');
 PERFORM distribution.expect_error('visit','{}','owner','Unknown action');

 result:=distribution.apply_action('product','{"name":"Buyer flow item","sku":"BUYER-FLOW","unit":"Unit","box_size":1,"carton_size":1,"price":10,"cost":1,"tax_rate":0,"min_stock":0}',owner_id,'owner',owner_id::text,gen_random_uuid());p_id:=(result->>'id')::uuid;
 result:=distribution.apply_action('vehicle',jsonb_build_object('number','BUYER-FLOW','type','Van','salesman_id',rep),owner_id,'owner',owner_id::text,gen_random_uuid());vehicle:=(result->>'id')::uuid;
 result:=distribution.apply_action('vehicle',jsonb_build_object('number','OTHER-BUYER-FLOW','type','Van','salesman_id',other_rep),owner_id,'owner',owner_id::text,gen_random_uuid());other_vehicle:=(result->>'id')::uuid;
 PERFORM distribution.apply_action('inventory',jsonb_build_object('product_id',p_id,'qty',40,'kind','RECEIPT'),owner_id,'owner',owner_id::text,gen_random_uuid());
 PERFORM distribution.apply_action('load',jsonb_build_object('vehicle_id',vehicle,'items',jsonb_build_array(jsonb_build_object('product_id',p_id,'qty',20))),owner_id,'owner',owner_id::text,gen_random_uuid());
 PERFORM distribution.apply_action('load',jsonb_build_object('vehicle_id',other_vehicle,'items',jsonb_build_array(jsonb_build_object('product_id',p_id,'qty',20))),owner_id,'owner',owner_id::text,gen_random_uuid());
 PERFORM distribution.apply_action('vehicle_status',jsonb_build_object('vehicle_id',vehicle,'status','ON ROUTE'),rep,'salesman',rep::text,gen_random_uuid());
 PERFORM distribution.apply_action('vehicle_status',jsonb_build_object('vehicle_id',other_vehicle,'status','ON ROUTE'),other_rep,'salesman',other_rep::text,gen_random_uuid());
 PERFORM distribution.check_true((SELECT route_id IS NULL AND status='ON ROUTE' FROM distribution.vehicles WHERE id=vehicle),'Loading and dispatch require no route');

 req:=gen_random_uuid();payload:=jsonb_build_object('vehicle_id',vehicle,'buyer',jsonb_build_object('name','Inline credit buyer','phone','Entered phone','address','Entered address'),'buyer_credit_limit',100,'buyer_salesman_id',rep,'items',jsonb_build_array(jsonb_build_object('product_id',p_id,'qty',2)),'discount',0,'paid',0,'method','CREDIT','reference','','notes','');
 result:=distribution.apply_action('sale',payload,owner_id,'owner',owner_id::text,req);sale_id:=(result->>'id')::uuid;
 SELECT customer_id INTO buyer_id FROM distribution.sales WHERE id=sale_id;
 PERFORM distribution.check_true((SELECT name='Inline credit buyer' AND phone='Entered phone' AND address='Entered address' AND balance=20 AND credit_limit=100 AND route_id IS NULL FROM distribution.customers WHERE id=buyer_id),'Sale saves real buyer details and explicitly authorized credit');
 PERFORM distribution.apply_action('sale',payload,owner_id,'owner',owner_id::text,req);
 PERFORM distribution.check_true((SELECT count(*)=1 FROM distribution.customers WHERE name='Inline credit buyer') AND (SELECT count(*)=1 FROM distribution.sales WHERE customer_id=buyer_id),'Ambiguous new-buyer sale retry duplicates neither buyer nor invoice');
 PERFORM distribution.check_true(EXISTS(SELECT 1 FROM distribution.buyer_access WHERE customer_id=buyer_id AND user_id=rep) AND NOT EXISTS(SELECT 1 FROM distribution.buyer_access WHERE customer_id=buyer_id AND user_id=other_rep),'Sale grants buyer access only to the explicitly selected representative');

 payload:=jsonb_build_object('vehicle_id',vehicle,'customer_id',buyer_id,'items',jsonb_build_array(jsonb_build_object('product_id',p_id,'qty',1)),'discount',0,'paid',0,'method','CREDIT','reference','','notes','');
 req:=gen_random_uuid(); result:=distribution.apply_action('sale',payload,rep,'salesman',rep::text,req);
 PERFORM distribution.apply_action('sale',payload,rep,'salesman',rep::text,req);
 PERFORM distribution.check_true((SELECT balance=30 FROM distribution.customers WHERE id=buyer_id),'Existing-buyer offline payload still records once on an assigned vehicle');
 PERFORM distribution.auth_expect_error(format('SELECT distribution.apply_action(%L,%L,%L,%L,%L,%L)','sale',payload::text,other_rep,'salesman',other_rep::text,gen_random_uuid()),'vehicle is not assigned');
 payload:=jsonb_set(payload,'{vehicle_id}',to_jsonb(other_vehicle));
 PERFORM distribution.auth_expect_error(format('SELECT distribution.apply_action(%L,%L,%L,%L,%L,%L)','sale',payload::text,other_rep,'salesman',other_rep::text,gen_random_uuid()),'buyer is not assigned');
 PERFORM distribution.auth_expect_error(format('SELECT distribution.apply_action(%L,%L,%L,%L,%L,%L)','payment',jsonb_build_object('customer_id',buyer_id,'amount',1,'method','CASH')::text,other_rep,'salesman',other_rep::text,gen_random_uuid()),'buyer is not assigned');
 payload:=jsonb_set(payload,'{vehicle_id}',to_jsonb(vehicle))||jsonb_build_object('buyer_credit_limit',200);
 PERFORM distribution.auth_expect_error(format('SELECT distribution.apply_action(%L,%L,%L,%L,%L,%L)','sale',payload::text,rep,'salesman',rep::text,gen_random_uuid()),'can change buyer credit or access');
 payload:=(payload-'buyer_credit_limit')||jsonb_build_object('buyer_salesman_id',other_rep);
 PERFORM distribution.auth_expect_error(format('SELECT distribution.apply_action(%L,%L,%L,%L,%L,%L)','sale',payload::text,rep,'salesman',rep::text,gen_random_uuid()),'can change buyer credit or access');
 PERFORM distribution.apply_action('payment',jsonb_build_object('customer_id',buyer_id,'amount',30,'method','UPI','reference','Buyer collection'),rep,'salesman',rep::text,gen_random_uuid());
 PERFORM distribution.check_true((SELECT balance=0 FROM distribution.customers WHERE id=buyer_id) AND NOT EXISTS(SELECT 1 FROM distribution.sales WHERE customer_id=buyer_id AND paid<>total),'Collections retain oldest-invoice allocation without customer management');

 payload:=jsonb_build_object('vehicle_id',vehicle,'buyer',jsonb_build_object('name','Representative entered buyer'),'items',jsonb_build_array(jsonb_build_object('product_id',p_id,'qty',1)),'discount',0,'paid',10,'method','CASH');
 result:=distribution.apply_action('sale',payload,rep,'salesman',rep::text,gen_random_uuid());
 SELECT customer_id INTO new_id FROM distribution.sales WHERE id=(result->>'id')::uuid;
 PERFORM distribution.check_true((SELECT credit_limit=0 AND balance=0 FROM distribution.customers WHERE id=new_id) AND EXISTS(SELECT 1 FROM distribution.buyer_access WHERE customer_id=new_id AND user_id=rep),'Representative records a new paid buyer with only their own access');
 SELECT count(*) INTO before_count FROM distribution.customers;
 SELECT qty INTO before_qty FROM distribution.vehicle_stock WHERE vehicle_id=vehicle AND product_id=p_id;
 payload:=jsonb_set(payload,'{paid}','0');
 PERFORM distribution.auth_expect_error(format('SELECT distribution.apply_action(%L,%L,%L,%L,%L,%L)','sale',payload::text,rep,'salesman',rep::text,gen_random_uuid()),'credit limit exceeded');
 PERFORM distribution.check_true((SELECT count(*)=before_count FROM distribution.customers) AND (SELECT qty=before_qty FROM distribution.vehicle_stock WHERE vehicle_id=vehicle AND product_id=p_id),'Failed inline-buyer sale rolls back buyer, access and stock changes');
 payload:=jsonb_build_object('vehicle_id',vehicle,'customer_id',buyer_id,'buyer_credit_limit',500,'buyer_salesman_id',other_rep,'items',jsonb_build_array(jsonb_build_object('product_id',p_id,'qty',999)),'paid',0,'method','CREDIT');
 PERFORM distribution.auth_expect_error(format('SELECT distribution.apply_action(%L,%L,%L,%L,%L,%L)','sale',payload::text,owner_id,'owner',owner_id::text,gen_random_uuid()),'Insufficient vehicle stock');
 PERFORM distribution.check_true((SELECT credit_limit=100 FROM distribution.customers WHERE id=buyer_id) AND NOT EXISTS(SELECT 1 FROM distribution.buyer_access WHERE customer_id=buyer_id AND user_id=other_rep),'Failed sale cannot alter buyer credit or grant access');
 -- Verify a subsequent deployment cannot restore explicitly revoked access.
 DELETE FROM distribution.buyer_access WHERE customer_id=legacy_buyer AND user_id=rep;
END $$;
