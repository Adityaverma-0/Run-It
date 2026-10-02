DO $$
BEGIN
 PERFORM distribution.check_true(NOT EXISTS(SELECT 1 FROM distribution.buyer_access a JOIN distribution.customers c ON c.id=a.customer_id WHERE c.name='Preserved legacy buyer'),'Repeated migration does not resurrect revoked legacy access');
 PERFORM distribution.check_true((SELECT c.balance=40 AND c.credit_limit=100 AND s.total=50 AND s.paid=10 AND p.amount=10 AND p.reference='Preserved receipt' FROM distribution.customers c JOIN distribution.sales s ON s.customer_id=c.id JOIN distribution.payments p ON p.sale_id=s.id WHERE c.name='Preserved legacy buyer'),'Repeated migration leaves existing financial history unchanged');
END $$;
