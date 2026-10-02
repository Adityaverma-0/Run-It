-- Only used inside the isolated, rolled-back integration schema, before 004.
DO $$
DECLARE rep uuid; other_rep uuid; legacy_route uuid; buyer uuid; vehicle uuid; invoice uuid;
BEGIN
 INSERT INTO distribution.users(name,email,role) VALUES('Legacy representative','legacy-rep@example.invalid','salesman') RETURNING id INTO rep;
 INSERT INTO distribution.users(name,email,role) VALUES('Unassigned representative','unassigned-rep@example.invalid','salesman') RETURNING id INTO other_rep;
 INSERT INTO distribution.routes(name) VALUES('Preserved legacy route') RETURNING id INTO legacy_route;
 INSERT INTO distribution.customers(name,phone,route_id,credit_limit,balance) VALUES('Preserved legacy buyer','legacy-phone',legacy_route,100,40) RETURNING id INTO buyer;
 INSERT INTO distribution.customers(name,credit_limit) VALUES('Unassigned legacy buyer',0);
 INSERT INTO distribution.vehicles(number,type,salesman_id,route_id,status) VALUES('LEGACY-VEHICLE','Van',rep,legacy_route,'CLOSED') RETURNING id INTO vehicle;
 INSERT INTO distribution.sales(customer_id,vehicle_id,salesman_id,items,subtotal,discount,tax,total,paid,method,created_by)
 VALUES(buyer,vehicle,rep,'[{"name":"Historic item","qty":1,"price":50,"subtotal":50}]',50,0,0,50,10,'CASH',rep) RETURNING id INTO invoice;
 INSERT INTO distribution.payments(customer_id,sale_id,amount,method,reference,created_by) VALUES(buyer,invoice,10,'CASH','Preserved receipt',rep);
 -- Model an ambiguous old-client response: its UUID and canonical payload must replay.
 INSERT INTO distribution.requests(id,actor_key,payload,result)
 VALUES('00000000-0000-4000-8000-000000000004',rep::text,
  jsonb_build_object('action','payment','data',jsonb_build_object('customer_id',buyer,'amount',10,'method','CASH','reference','Preserved receipt')),
  jsonb_build_object('id',invoice,'message','Previously confirmed'));
END $$;
