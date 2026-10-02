export type Row = Record<string, any>;
export type State = {
  user: Row;
  settings: Row | null;
  products: Row[];
  customers: Row[];
  vehicles: Row[];
  stock: Row[];
  days: Row[];
  routes: Row[];
  sales: Row[];
  payments: Row[];
  loads: Row[];
  reconciliations: Row[];
  movements: Row[];
  visits: Row[];
  activity: Row[];
  users: Row[];
  itemTypes: Row[];
  dailyReports: Row[];
  reads: Row[];
  serverTime: string;
};
export const money = (n: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
export const num = (n: any) =>
  new Intl.NumberFormat("en-IN").format(Number(n || 0));
export const day = (d: any = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
export const date = (d: any) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
export const time = (d: any) =>
  new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
export const sum = (rows: Row[], key: string) =>
  rows.reduce((n, r) => n + Number(r[key] || 0), 0);
export const roleNames: Record<string, string> = {
  owner: "Business owner",
  worker: "Worker",
  warehouse_manager: "Warehouse manager",
  warehouse_staff: "Warehouse staff",
  sales_manager: "Sales manager",
  salesman: "Sales representative",
  accountant: "Accountant",
};
export const permissions: Record<string, string[]> = {
  owner: ["*"],
  worker: [
    "dashboard",
    "sales",
    "customers",
    "products",
    "item-types",
    "inventory",
    "vehicles",
    "loads",
    "payments",
    "routes",
    "reports",
    "daily-reports",
    "reconciliation",
    "notifications",
    "sync",
  ],
  warehouse_manager: [
    "dashboard",
    "products",
    "item-types",
    "inventory",
    "vehicles",
    "loads",
    "reconciliation",
    "notifications",
    "reports",
    "sync",
  ],
  warehouse_staff: [
    "dashboard",
    "products",
    "inventory",
    "vehicles",
    "loads",
    "notifications",
    "sync",
  ],
  sales_manager: [
    "dashboard",
    "sales",
    "customers",
    "products",
    "vehicles",
    "payments",
    "routes",
    "reports",
    "reconciliation",
    "notifications",
    "sync",
  ],
  salesman: [
    "dashboard",
    "sales",
    "customers",
    "products",
    "vehicles",
    "payments",
    "routes",
    "reconciliation",
    "notifications",
    "sync",
  ],
  accountant: [
    "dashboard",
    "sales",
    "customers",
    "payments",
    "reports",
    "notifications",
    "sync",
  ],
};
export const actions: Record<string, string[]> = {
  owner: ["*"],
  worker: [
    "product",
    "item_type",
    "customer",
    "route",
    "vehicle",
    "inventory",
    "load",
    "start_day",
    "sale",
    "payment",
    "visit",
    "vehicle_status",
    "reconcile",
    "submit_daily_report",
    "mark_read",
  ],
  warehouse_manager: [
    "product",
    "item_type",
    "vehicle",
    "load",
    "start_day",
    "inventory",
    "vehicle_status",
    "reconcile",
    "mark_read",
  ],
  warehouse_staff: [
    "load",
    "start_day",
    "inventory",
    "vehicle_status",
    "mark_read",
  ],
  sales_manager: [
    "customer",
    "route",
    "sale",
    "payment",
    "visit",
    "vehicle_status",
    "reconcile",
    "mark_read",
  ],
  salesman: [
    "sale",
    "payment",
    "visit",
    "vehicle_status",
    "reconcile",
    "mark_read",
  ],
  accountant: ["payment", "mark_read"],
};
export const can = (role: string, action: string) =>
  actions[role]?.includes("*") || actions[role]?.includes(action);
export function stockSummary(s: State, vehicleId: string) {
  const v = s.vehicles.find((x) => x.id === vehicleId);
  const active = v?.active_day;
  const opening =
    s.days.find((x) => x.vehicle_id === vehicleId && x.day === active)
      ?.opening || [];
  return {
    opening: sum(opening, "qty"),
    loaded: sum(
      s.loads.filter(
        (x) => x.vehicle_id === vehicleId && day(x.created_at) === active,
      ),
      "qty",
    ),
    sold: sum(
      s.movements.filter(
        (x) =>
          x.vehicle_id === vehicleId &&
          x.kind === "SALE" &&
          day(x.created_at) === active,
      ),
      "qty",
    ),
    remaining: sum(
      s.stock.filter((x) => x.vehicle_id === vehicleId),
      "qty",
    ),
  };
}
export function notifications(s: State) {
  const read = new Set(s.reads.map((x) => x.notification_key));
  return [
    ...s.products
      .filter((p) => p.active && p.warehouse_qty <= p.min_stock)
      .map((p) => ({
        id: "stock-" + p.id,
        type: "Low stock",
        message: `${p.name} has ${num(p.warehouse_qty)} ${p.unit.toLowerCase()}s available. Minimum: ${num(p.min_stock)}.`,
        page: "inventory",
        tone: "amber",
      })),
    ...s.vehicles
      .filter((v) => ["RETURNED", "RECONCILIATION"].includes(v.status))
      .map((v) => ({
        id: "recon-" + v.id + "-" + v.active_day,
        type: "Reconciliation",
        message: `${v.number} is waiting for end-of-day reconciliation.`,
        page: "reconciliation",
        tone: "amber",
      })),
    ...s.activity.map((a) => ({
      id: a.id,
      type: a.action.replaceAll("_", " "),
      message: a.message,
      page:
        (
          {
            sale: "sales",
            payment: "payments",
            load: "loads",
            reconcile: "reconciliation",
            customer: "customers",
            vehicle: "vehicles",
            product: "products",
            inventory: "inventory",
            item_type: "item-types",
            submit_daily_report: "daily-reports",
            review_daily_report: "daily-reports",
            route: "routes",
            user: "settings",
          } as any
        )[a.action] || "dashboard",
      tone: "",
      created_at: a.created_at,
    })),
  ].map((n) => ({ ...n, read: read.has(n.id) }));
}
export function exportCSV(name: string, rows: Row[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const safe = (v: any) => {
    const raw = String(v ?? "");
    return (
      '"' + (/^[=+@-]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""') + '"'
    );
  };
  const csv =
    "\ufeff" +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((row) => row.map(safe).join(","))
      .join("\r\n");
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  a.href = url;
  a.download = `${name}-${day()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
