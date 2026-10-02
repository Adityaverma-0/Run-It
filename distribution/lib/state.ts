import { sql } from "./db";
import type { Member } from "./auth";
export async function getState(u: Member) {
  const client = sql();
  const query = (text: string, params: any[] = []) =>
    client.query(text, params);
  const sales = u.role === "salesman";
  const accountant = u.role === "accountant";
  const warehouse = u.role.startsWith("warehouse");
  const owner = u.role === "owner";
  const worker = u.role === "worker";
  const canFinance = !warehouse;
  const customerWhere = sales
    ? "WHERE c.route_id IN (SELECT route_id FROM distribution.vehicles WHERE salesman_id=$1::uuid)"
    : "";
  const vehicleWhere = sales ? "WHERE v.salesman_id=$1::uuid" : "";
  const salesWhere = sales ? "WHERE s.salesman_id=$1::uuid" : "";
  const params = sales ? [u.id] : [];
  const tasks: Record<string, any> = {
    itemTypes: query(
      "SELECT * FROM distribution.item_types ORDER BY kind,name",
    ),
    dailyReports:
      owner || worker
        ? query(
            `SELECT r.id,r.report_day,r.submitted_by,r.revision,r.submitted_at,r.reviewed_at,u.name AS submitted_by_name FROM distribution.daily_reports r JOIN distribution.users u ON u.id=r.submitted_by ${owner ? "" : "WHERE r.submitted_by=$1::uuid"} ORDER BY (r.reviewed_at IS NULL) DESC,r.submitted_at DESC LIMIT 100`,
            owner ? [] : [u.id],
          )
        : query("SELECT NULL WHERE false"),
    settings: query("SELECT * FROM distribution.settings WHERE id=1"),
    products: query(
      `SELECT p.*,coalesce((SELECT sum(vs.qty) FROM distribution.vehicle_stock vs ${sales ? "JOIN distribution.vehicles v ON v.id=vs.vehicle_id" : ""} WHERE vs.product_id=p.id ${sales ? "AND v.salesman_id=$1::uuid" : ""}),0)::integer AS vehicle_qty FROM distribution.products p ORDER BY p.name`,
      params,
    ),
    vehicles: query(
      `SELECT v.*,u.name AS salesman_name,r.name AS route_name,coalesce((SELECT sum(qty) FROM distribution.vehicle_stock WHERE vehicle_id=v.id),0)::integer AS stock_qty FROM distribution.vehicles v LEFT JOIN distribution.users u ON u.id=v.salesman_id LEFT JOIN distribution.routes r ON r.id=v.route_id ${vehicleWhere} ORDER BY v.number`,
      params,
    ),
    stock: query(
      `SELECT vs.* FROM distribution.vehicle_stock vs ${sales ? "JOIN distribution.vehicles v ON v.id=vs.vehicle_id WHERE v.salesman_id=$1::uuid" : ""}`,
      params,
    ),
    days: query(
      `SELECT d.* FROM distribution.vehicle_days d ${sales ? "JOIN distribution.vehicles v ON v.id=d.vehicle_id WHERE v.salesman_id=$1::uuid" : ""} ORDER BY day DESC`,
      params,
    ),
    routes: query(
      `SELECT r.* FROM distribution.routes r ${sales ? "WHERE r.id IN (SELECT route_id FROM distribution.vehicles WHERE salesman_id=$1::uuid)" : ""} ORDER BY name`,
      params,
    ),
    customers: canFinance
      ? query(
          `SELECT c.*,r.name AS route_name FROM distribution.customers c LEFT JOIN distribution.routes r ON r.id=c.route_id ${customerWhere} ORDER BY name`,
          params,
        )
      : query("SELECT NULL WHERE false"),
    sales: canFinance
      ? query(
          `SELECT s.*,c.name AS customer_name,v.number AS vehicle_number,u.name AS salesman_name,c.route_id FROM distribution.sales s JOIN distribution.customers c ON c.id=s.customer_id JOIN distribution.vehicles v ON v.id=s.vehicle_id LEFT JOIN distribution.users u ON u.id=s.salesman_id ${salesWhere} ORDER BY created_at DESC`,
          params,
        )
      : query("SELECT NULL WHERE false"),
    payments: canFinance
      ? query(
          `SELECT p.*,c.name AS customer_name,c.route_id FROM distribution.payments p JOIN distribution.customers c ON c.id=p.customer_id ${sales ? "WHERE c.route_id IN (SELECT route_id FROM distribution.vehicles WHERE salesman_id=$1::uuid)" : ""} ORDER BY p.created_at DESC`,
          params,
        )
      : query("SELECT NULL WHERE false"),
    loads: query(
      `SELECT l.*,v.number AS vehicle_number FROM distribution.loads l JOIN distribution.vehicles v ON v.id=l.vehicle_id ${sales ? "WHERE v.salesman_id=$1::uuid" : ""} ORDER BY l.created_at DESC`,
      params,
    ),
    reconciliations: query(
      `SELECT r.*,v.number AS vehicle_number FROM distribution.reconciliations r JOIN distribution.vehicles v ON v.id=r.vehicle_id ${sales ? "WHERE v.salesman_id=$1::uuid" : ""} ORDER BY r.created_at DESC`,
      params,
    ),
    movements: query(
      `SELECT m.*,p.name AS product_name,v.number AS vehicle_number,u.name AS recorded_by FROM distribution.movements m JOIN distribution.products p ON p.id=m.product_id LEFT JOIN distribution.vehicles v ON v.id=m.vehicle_id LEFT JOIN distribution.users u ON u.id=m.created_by ${sales ? "WHERE v.salesman_id=$1::uuid" : ""} ORDER BY m.created_at DESC`,
      params,
    ),
    visits: canFinance
      ? query(
          `SELECT vs.* FROM distribution.visits vs ${sales ? "WHERE user_id=$1::uuid" : ""}`,
          params,
        )
      : query("SELECT NULL WHERE false"),
    activity: query(
      `SELECT a.*,u.name AS recorded_by FROM distribution.activity a LEFT JOIN distribution.users u ON u.id=a.created_by ${owner || worker ? "" : sales ? "WHERE a.created_by=$1::uuid" : warehouse ? "WHERE action IN ('product','item_type','load','inventory','vehicle','vehicle_status','reconcile')" : "WHERE action IN ('sale','payment','customer','visit')"} ORDER BY a.created_at DESC LIMIT 100`,
      params,
    ),
    users: owner
      ? query("SELECT * FROM distribution.users ORDER BY name")
      : !sales && !accountant
        ? query(
            "SELECT id,name,role,active FROM distribution.users WHERE role IN ('salesman','worker') AND active ORDER BY name",
          )
        : query("SELECT NULL WHERE false"),
    reads: query(
      "SELECT notification_key FROM distribution.notification_reads WHERE user_key=$1",
      [u.key],
    ),
  };
  const keys = Object.keys(tasks);
  const results = await client.transaction(Object.values(tasks), {
    isolationLevel: "RepeatableRead",
    readOnly: true,
  });
  const entries = keys.map((key, i) => [key, results[i]]);
  const state = Object.fromEntries(entries);
  state.settings = state.settings[0] || null;
  if (!owner && !warehouse && !worker)
    state.products = state.products.map(({ cost, ...p }: any) => p);
  return { ...state, user: u, serverTime: new Date().toISOString() };
}
