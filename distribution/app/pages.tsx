"use client";
import { useState } from "react";
import { InviteButton } from "./access";
import { WorkerDashboard, AdminDailyPanel } from "./operations";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  Coins,
  Truck,
  Package,
  Wallet,
  Box,
  ShoppingCart,
  ShieldCheck,
  Plus,
  Search,
  Download,
  ClipboardCheck,
  ClipboardList,
  ChartNoAxesCombined,
  Users,
  Warehouse,
  Check,
  Activity,
  FileText,
  RefreshCw,
  Cloud,
  AlertCircle,
  Clock,
  Settings,
  Mail,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Btn,
  Empty,
  Kpi,
  DataTable,
  Pick,
  Badge,
  StockFlow,
  Field,
} from "./ui";
import {
  money,
  num,
  day,
  date,
  time,
  sum,
  roleNames,
  can,
  stockSummary,
  notifications,
  exportCSV,
  type State,
  type Row,
} from "@/lib/client";
export type PageProps = {
  pendingCount?: number;
  s: State;
  go: (p: string) => void;
  open: (kind: string, initial?: Row) => void;
  detail: (kind: string, row: Row) => void;
  save: (action: string, data: Row) => Promise<any>;
};
export function Dashboard({
  s,
  go,
  open,
  detail,
  save,
  pendingCount,
}: PageProps) {
  const [range, setRange] = useState("week");
  const today = day();
  const todays = s.sales.filter((x) => day(x.created_at) === today);
  const low = s.products.filter(
    (x) => x.active && x.warehouse_qty <= x.min_stock,
  );
  const onRoute = s.vehicles.filter((v) => v.status === "ON ROUTE");
  const warehouse = s.user.role.startsWith("warehouse");
  const salesman = s.user.role === "salesman";
  const accountant = s.user.role === "accountant";
  const v = s.vehicles[0];
  const days = Array.from({ length: range === "week" ? 7 : 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (range === "week" ? 6 : 29) + i);
    const key = day(d);
    return {
      date: key,
      label: d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      sales: sum(
        s.sales.filter((x) => day(x.created_at) === key),
        "total",
      ),
    };
  });
  const anySales = days.some((x) => x.sales > 0);
  const recent = s.sales.slice(0, 5);
  const progress = [
    {
      key: "products",
      label: "Add products",
      done: s.products.length > 0,
      action: "product",
    },
    {
      key: "vehicles",
      label: "Add vehicles",
      done: s.vehicles.length > 0,
      action: "vehicle",
    },
  ].filter((x) => can(s.user.role, x.action));
  const needsSetup = progress.some((p) => !p.done);
  if (s.user.role === "worker")
    return (
      <WorkerDashboard
        s={s}
        go={go}
        open={open}
        detail={detail}
        save={save}
        pendingCount={pendingCount}
      />
    );
  if (salesman)
    return (
      <div className="stack">
        {v ? (
          <section className="clay panel">
            <div className="spread">
              <div>
                <span className="eyebrow">YOUR VEHICLE</span>
                <h2 className="mt-2">{v.number}</h2>
              </div>
              <Badge>{v.status}</Badge>
            </div>
            <StockFlow summary={stockSummary(s, v.id)} />
            <Btn
              onClick={() => open("sale", { vehicle_id: v.id })}
              disabled={v.status !== "ON ROUTE"}
            >
              <Plus size={17} />
              New sale
            </Btn>
            {v.status !== "ON ROUTE" && (
              <p className="form-help mt-3">
                The vehicle must be loaded and dispatched before recording
                sales.
              </p>
            )}
          </section>
        ) : (
          <section className="clay">
            <Empty
              icon={Truck}
              title="No vehicle assigned"
              description="Your manager can assign a vehicle to your account."
            />
          </section>
        )}
        <div className="mobile-actions">
          {[
            ["payments", "Payments", Wallet],
            ["products", "Stock", Package],
          ].map(([id, title, Icon]: any) => (
            <button className="clay" key={id} onClick={() => go(id)}>
              <Icon size={22} />
              {title}
            </button>
          ))}
        </div>
        <div className="stats">
          <Kpi
            title="Today's sales"
            value={money(sum(todays, "total"))}
            foot={`${todays.length} confirmed orders`}
            icon={Coins}
            tone="teal"
          />
          <Kpi
            title="Collections today"
            value={money(
              sum(
                s.payments.filter(
                  (x) =>
                    day(x.created_at) === today && x.created_by === s.user.id,
                ),
                "amount",
              ),
            )}
            foot="Payments you recorded"
            icon={Users}
          />
        </div>
      </div>
    );
  return (
    <>
      <div className="stats">
        {warehouse ? (
          <>
            <Kpi
              title="Warehouse stock"
              value={num(sum(s.products, "warehouse_qty"))}
              foot="Base units available"
              icon={Package}
            />
            <Kpi
              title="Today's loads"
              value={num(
                s.loads.filter((x) => day(x.created_at) === today).length,
              )}
              foot="Confirmed stock transfers"
              icon={ClipboardList}
              tone="teal"
            />
            <Kpi
              title="Vehicles returned"
              value={num(
                s.vehicles.filter((v) =>
                  ["RETURNED", "RECONCILIATION"].includes(v.status),
                ).length,
              )}
              foot="Awaiting end-of-day close"
              icon={Truck}
            />
            <Kpi
              title="Low stock products"
              value={num(low.length)}
              foot="At or below minimum level"
              icon={AlertCircle}
              tone="amber"
            />
          </>
        ) : (
          <>
            <Kpi
              title="Today's sales"
              value={money(sum(todays, "total"))}
              foot={`${todays.length} confirmed ${todays.length === 1 ? "order" : "orders"} today`}
              icon={Coins}
              tone="teal"
            />
            <Kpi
              title={accountant ? "Payments today" : "Vehicles dispatched"}
              value={
                accountant
                  ? money(
                      sum(
                        s.payments.filter((x) => day(x.created_at) === today),
                        "amount",
                      ),
                    )
                  : `${onRoute.length} / ${s.vehicles.length}`
              }
              foot={
                accountant
                  ? "Confirmed customer collections"
                  : s.vehicles.length
                    ? "Active deliveries"
                    : "Add vehicles to start deliveries"
              }
              icon={accountant ? Wallet : Truck}
            />
            <Kpi
              title={accountant ? "Customer accounts" : "Warehouse stock"}
              value={num(
                accountant
                  ? s.customers.length
                  : sum(s.products, "warehouse_qty"),
              )}
              foot={
                accountant
                  ? "Managed credit accounts"
                  : "Base units available for loading"
              }
              icon={accountant ? Users : Package}
            />
            <Kpi
              title="Outstanding payments"
              value={money(sum(s.customers, "balance"))}
              foot={`${s.customers.filter((c) => Number(c.balance) > 0).length} customers with a balance`}
              icon={Wallet}
              tone="amber"
            />
          </>
        )}
      </div>
      {s.user.role === "owner" && <AdminDailyPanel s={s} go={go} />}
      {needsSetup && (
        <div className="onboarding">
          <div className="flex-row">
            <span className="kpi-icon">
              <Box size={23} />
            </span>
            <div>
              <h3>A fresh start for your distribution.</h3>
              <p>Add your business essentials to get the first day moving.</p>
            </div>
          </div>
          <div className="checklist">
            {progress.map((p, i) => (
              <button
                className="check-step"
                key={p.key}
                onClick={() => (p.done ? go(p.key) : open(p.action))}
              >
                <span>{p.done ? <Check size={10} /> : i + 1}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {warehouse ? (
        <section className="clay panel mb-6">
          <div className="panel-head">
            <div>
              <h2>Today's vehicle operations</h2>
              <p>Opening stock, loads and closing counts</p>
            </div>
            {can(s.user.role, "load") && (
              <Btn onClick={() => open("load")}>
                <Plus size={14} />
                Create load
              </Btn>
            )}
          </div>
          {!s.vehicles.length ? (
            <Empty
              icon={Truck}
              title="No vehicles yet"
              description="Add your first vehicle to plan warehouse operations."
            />
          ) : (
            <div className="grid3">
              {s.vehicles.map((v) => (
                <div className="stock-card clay" key={v.id}>
                  <div className="spread">
                    <h3>{v.number}</h3>
                    <Badge>{v.status}</Badge>
                  </div>
                  <p className="small muted">
                    {v.salesman_name || "Unassigned"}
                  </p>
                  <StockFlow summary={stockSummary(s, v.id)} />
                  <div className="spread">
                    <Btn light onClick={() => detail("vehicles", v)}>
                      View vehicle
                    </Btn>
                    {can(s.user.role, "reconcile") &&
                      [
                        "LOADED",
                        "ON ROUTE",
                        "RETURNED",
                        "RECONCILIATION",
                      ].includes(v.status) && (
                        <Btn
                          onClick={() =>
                            open("reconcile", { vehicle_id: v.id })
                          }
                        >
                          Reconcile
                        </Btn>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="dashboard-grid">
          <section className="clay panel">
            <div className="panel-head">
              <div>
                <h2>Sales overview</h2>
                <p>Your daily sales performance</p>
              </div>
              <div className="view-switch">
                <button
                  className={range === "week" ? "active" : ""}
                  onClick={() => setRange("week")}
                >
                  7 days
                </button>
                <button
                  className={range === "month" ? "active" : ""}
                  onClick={() => setRange("month")}
                >
                  30 days
                </button>
              </div>
            </div>
            {anySales ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={days}>
                    <defs>
                      <linearGradient
                        id="sales-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#70a7ac"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="#70a7ac"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#dce5ee"
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#8798ad" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#8798ad" }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                      tickFormatter={(v) =>
                        `₹${v >= 1000 ? v / 1000 + "k" : v}`
                      }
                    />
                    <Tooltip
                      formatter={(v: any) => money(v)}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #dce5ee",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#5d939d"
                      strokeWidth={2.5}
                      fill="url(#sales-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <>
                <div className="chart-placeholder">
                  <div className="empty-label">
                    <ChartNoAxesCombined size={24} />
                    <h3 className="muted">Your sales story starts here</h3>
                    <p className="small muted">
                      Recorded sales will appear in this chart.
                    </p>
                  </div>
                </div>
                <div className="chart-axis">
                  {days
                    .filter((_, i) => range === "week" || i % 5 === 0)
                    .map((d) => (
                      <span key={d.date}>{d.label}</span>
                    ))}
                </div>
              </>
            )}
          </section>
          <section className="clay panel">
            <div className="panel-head">
              <div>
                <h2>{accountant ? "Payment collections" : "Fleet overview"}</h2>
                <p>
                  {accountant
                    ? "Keep every customer account in balance"
                    : "From the warehouse to the last stop"}
                </p>
              </div>
              <button
                className="text-link"
                onClick={() => go(accountant ? "payments" : "vehicles")}
              >
                View {accountant ? "payments" : "fleet"}
              </button>
            </div>
            {accountant ? (
              s.payments.length ? (
                s.payments.slice(0, 4).map((p) => (
                  <div className="fleet-row" key={p.id}>
                    <div>
                      <h3>{p.customer_name}</h3>
                      <span className="small muted">
                        {date(p.created_at)} · {p.method}
                      </span>
                    </div>
                    <b>{money(p.amount)}</b>
                  </div>
                ))
              ) : (
                <Empty
                  icon={Wallet}
                  title="No collections yet"
                  description="Recorded customer payments will appear here."
                />
              )
            ) : (
              <>
                <div className="mini-grid">
                  {["ON ROUTE", "LOADED", "RETURNED"].map((x) => (
                    <div className="mini-stat" key={x}>
                      <b>{s.vehicles.filter((v) => v.status === x).length}</b>
                      <span>
                        {x === "LOADED"
                          ? "Loading"
                          : x === "ON ROUTE"
                            ? "Dispatched"
                            : "Returned"}
                      </span>
                    </div>
                  ))}
                </div>
                {s.vehicles.length ? (
                  s.vehicles.slice(0, 3).map((v) => (
                    <button
                      className="fleet-row w-full text-left"
                      key={v.id}
                      onClick={() => detail("vehicles", v)}
                    >
                      <div>
                        <h3>{v.number}</h3>
                        <span className="small muted">
                          {v.salesman_name || "No salesman assigned"}
                        </span>
                      </div>
                      <Badge>{v.status}</Badge>
                    </button>
                  ))
                ) : (
                  <Empty
                    icon={Truck}
                    title="Ready for your first delivery"
                    description="Your vehicles and their live status will appear here."
                  />
                )}
              </>
            )}
          </section>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="clay panel">
          <div className="panel-head">
            <div>
              <h2>{warehouse ? "Recent stock movements" : "Recent sales"}</h2>
              <p>
                {warehouse
                  ? "A clear trail for every unit"
                  : "Your latest customer orders"}
              </p>
            </div>
            <button
              className="text-link"
              onClick={() => go(warehouse ? "inventory" : "sales")}
            >
              View all
            </button>
          </div>
          {warehouse ? (
            <DataTable
              columns={[
                { key: "product_name", label: "Product" },
                {
                  key: "kind",
                  label: "Movement",
                  render: (r) => <Badge>{r.kind}</Badge>,
                },
                { key: "qty", label: "Units" },
              ]}
              rows={s.movements.slice(0, 5)}
              empty="No stock movements yet"
            />
          ) : recent.length ? (
            <DataTable
              rows={recent}
              columns={[
                {
                  key: "customer_name",
                  label: "Customer",
                  render: (r) => (
                    <>
                      <span className="list-title">{r.customer_name}</span>
                      <p className="table-sub">
                        INV-{String(r.invoice_no).padStart(6, "0")}
                      </p>
                    </>
                  ),
                },
                {
                  key: "total",
                  label: "Amount",
                  render: (r) => money(r.total),
                },
                {
                  key: "paid",
                  label: "Payment",
                  render: (r) => (
                    <Badge>
                      {Number(r.paid) >= Number(r.total) ? "Paid" : "Pending"}
                    </Badge>
                  ),
                },
              ]}
              onRow={(r) => detail("sales", r)}
            />
          ) : (
            <Empty
              icon={ShoppingCart}
              title="No sales recorded yet"
              description="Create your first sale after loading a vehicle."
            />
          )}
        </section>
        <section className="clay panel">
          <div className="panel-head">
            <div>
              <h2>{accountant ? "Outstanding customers" : "Stock watch"}</h2>
              <p>
                {accountant
                  ? "Balances ready for collection"
                  : "Stay ahead of your next load"}
              </p>
            </div>
            <button
              className="text-link"
              onClick={() => go(accountant ? "payments" : "inventory")}
            >
              View {accountant ? "payments" : "inventory"}
            </button>
          </div>
          {accountant ? (
            <DataTable
              rows={s.customers
                .filter((c) => Number(c.balance) > 0)
                .slice(0, 5)}
              columns={[
                { key: "name", label: "Customer" },
                {
                  key: "balance",
                  label: "Outstanding",
                  render: (r) => money(r.balance),
                },
              ]}
              empty="No outstanding balances"
            />
          ) : low.length ? (
            low.slice(0, 4).map((p) => (
              <button
                className="fleet-row w-full text-left"
                key={p.id}
                onClick={() => detail("products", p)}
              >
                <div>
                  <h3>{p.name}</h3>
                  <p className="small muted">Minimum: {p.min_stock} units</p>
                </div>
                <span className="badge amber">{num(p.warehouse_qty)} left</span>
              </button>
            ))
          ) : (
            <Empty
              icon={ShieldCheck}
              title={
                s.products.length
                  ? "Stock levels look healthy"
                  : "Inventory starts with your products"
              }
              description={
                s.products.length
                  ? "All active products are above their minimum levels."
                  : "Low stock alerts will appear as you build your catalogue."
              }
            />
          )}
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="clay panel">
          <div className="panel-head">
            <h2>Recent activity</h2>
            <button className="text-link" onClick={() => go("notifications")}>
              View activity
            </button>
          </div>
          {s.activity.length ? (
            s.activity.slice(0, 5).map((a) => (
              <div className="activity-row" key={a.id}>
                <span className="kpi-icon" style={{ height: 31, width: 31 }}>
                  <Activity size={14} />
                </span>
                <div>
                  <p>{a.message}</p>
                  <small>
                    {date(a.created_at)} · {time(a.created_at)}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <Empty
              icon={Activity}
              title="Your activity, in one place"
              description="Loads, sales, payments and closing events will appear here."
            />
          )}
        </section>
        <section className="clay panel">
          <div className="panel-head">
            <h2>{warehouse ? "Warehouse summary" : "Top products"}</h2>
            <button
              className="text-link"
              onClick={() => go(warehouse ? "inventory" : "reports")}
            >
              View {warehouse ? "stock" : "reports"}
            </button>
          </div>
          {warehouse ? (
            <div className="compact-kpis">
              <div>
                <b>{s.products.length}</b>
                <span>Products</span>
              </div>
              <div>
                <b>{num(sum(s.stock, "qty"))}</b>
                <span>In vehicles</span>
              </div>
              <div>
                <b>{num(sum(s.products, "damaged_qty"))}</b>
                <span>Damaged units</span>
              </div>
            </div>
          ) : (
            <RankProducts sales={s.sales} />
          )}
        </section>
      </div>
    </>
  );
}
function RankProducts({ sales }: { sales: Row[] }) {
  const counts: Record<string, Row> = {};
  for (const sale of sales)
    for (const line of sale.items) {
      counts[line.product_id] ??= { name: line.name, qty: 0, total: 0 };
      counts[line.product_id].qty += line.qty;
      counts[line.product_id].total += Number(line.subtotal);
    }
  const rows = Object.values(counts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  return rows.length ? (
    <div>
      {rows.map((p, i) => (
        <div className="fleet-row" key={p.name}>
          <div className="flex-row">
            <span className="avatar">{i + 1}</span>
            <div>
              <h3>{p.name}</h3>
              <p className="small muted">{num(p.qty)} units sold</p>
            </div>
          </div>
          <b className="small">{money(p.total)}</b>
        </div>
      ))}
    </div>
  ) : (
    <Empty
      icon={Package}
      title="Discover your bestsellers"
      description="Your highest-selling products will appear after your first sales."
    />
  );
}
const definitions: Record<
  string,
  {
    title: string;
    action?: string;
    button?: string;
    search: string;
    columns: any[];
  }
> = {
  products: {
    title: "Products",
    action: "product",
    button: "Add product",
    search: "Search product name, SKU or brand",
    columns: [
      {
        key: "name",
        label: "Product",
        render: (r: Row) => (
          <>
            <span className="list-title">{r.name}</span>
            <p className="table-sub">
              {r.sku} · {r.brand || "No brand"}
            </p>
          </>
        ),
      },
      { key: "category", label: "Category" },
      {
        key: "unit",
        label: "Packaging",
        render: (r: Row) => `${r.box_size} ${r.unit.toLowerCase()}s / box`,
      },
      {
        key: "warehouse_qty",
        label: "Warehouse",
        render: (r: Row) => num(r.warehouse_qty),
      },
      {
        key: "price",
        label: "Selling price",
        render: (r: Row) => money(r.price),
      },
      { key: "min_stock", label: "Min stock" },
      {
        key: "active",
        label: "Status",
        render: (r: Row) => (
          <Badge>
            {!r.active
              ? "Inactive"
              : r.warehouse_qty <= r.min_stock
                ? "Low stock"
                : "Active"}
          </Badge>
        ),
      },
    ],
  },
  vehicles: {
    title: "Vehicles",
    action: "vehicle",
    button: "Add vehicle",
    search: "Search vehicle or salesman",
    columns: [
      {
        key: "number",
        label: "Vehicle",
        render: (r: Row) => (
          <>
            <span className="list-title">{r.number}</span>
            <p className="table-sub">{r.type}</p>
          </>
        ),
      },
      {
        key: "salesman_name",
        label: "Salesman",
        render: (r: Row) => r.salesman_name || "Unassigned",
      },
      {
        key: "status",
        label: "Status",
        render: (r: Row) => <Badge>{r.status}</Badge>,
      },
      {
        key: "stock_qty",
        label: "Remaining units",
        render: (r: Row) => num(r.stock_qty),
      },
      {
        key: "updated_at",
        label: "Last activity",
        render: (r: Row) => date(r.updated_at),
      },
    ],
  },
  sales: {
    title: "Sales",
    action: "sale",
    button: "New sale",
    search: "Search invoice, shop or vehicle",
    columns: [
      {
        key: "invoice_no",
        label: "Invoice",
        render: (r: Row) => (
          <>
            <span className="list-title">
              INV-{String(r.invoice_no).padStart(6, "0")}
            </span>
            <p className="table-sub">
              {date(r.created_at)} · {time(r.created_at)}
            </p>
          </>
        ),
      },
      { key: "customer_name", label: "Customer" },
      { key: "vehicle_number", label: "Vehicle" },
      { key: "total", label: "Total", render: (r: Row) => money(r.total) },
      { key: "paid", label: "Paid", render: (r: Row) => money(r.paid) },
      {
        key: "method",
        label: "Method",
        render: (r: Row) => <Badge>{r.method}</Badge>,
      },
      {
        key: "status",
        label: "Status",
        render: (r: Row) => (
          <Badge>
            {Number(r.paid) >= Number(r.total) ? "Paid" : "Pending"}
          </Badge>
        ),
      },
    ],
  },
  payments: {
    title: "Payments",
    action: "payment",
    button: "Collect payment",
    search: "Search customer or reference",
    columns: [
      {
        key: "created_at",
        label: "Date",
        render: (r: Row) => (
          <>
            {date(r.created_at)}
            <p className="table-sub">{time(r.created_at)}</p>
          </>
        ),
      },
      { key: "customer_name", label: "Customer" },
      {
        key: "amount",
        label: "Amount received",
        render: (r: Row) => money(r.amount),
      },
      {
        key: "method",
        label: "Method",
        render: (r: Row) => <Badge>{r.method}</Badge>,
      },
      {
        key: "reference",
        label: "Reference",
        render: (r: Row) => r.reference || "—",
      },
    ],
  },
  loads: {
    title: "Loads",
    action: "load",
    button: "Create load",
    search: "Search vehicle",
    columns: [
      { key: "vehicle_number", label: "Vehicle" },
      {
        key: "created_at",
        label: "Loaded at",
        render: (r: Row) => `${date(r.created_at)} · ${time(r.created_at)}`,
      },
      { key: "qty", label: "Loaded units", render: (r: Row) => num(r.qty) },
      {
        key: "items",
        label: "Product lines",
        render: (r: Row) => r.items.length,
      },
      {
        key: "status",
        label: "Status",
        render: () => <Badge>Confirmed</Badge>,
      },
    ],
  },
  reconciliation: {
    title: "Reconciliation",
    action: "reconcile",
    button: "Reconcile vehicle",
    search: "Search vehicle or decision",
    columns: [
      { key: "vehicle_number", label: "Vehicle" },
      { key: "day", label: "Vehicle day" },
      {
        key: "decision",
        label: "Closing decision",
        render: (r: Row) => <Badge>{r.decision}</Badge>,
      },
      { key: "qty", label: "Physical units" },
      { key: "variance", label: "Loss units" },
      { key: "notes", label: "Notes" },
    ],
  },
};
export function Listing({ page, ...props }: PageProps & { page: string }) {
  const { s, open, detail } = props;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [cursor, setCursor] = useState(0);
  const def = definitions[page];
  const rows = (
    page === "reconciliation" ? s.reconciliations : (s as any)[page]
  ) as Row[];
  const filtered = rows
    .filter((r) =>
      Object.values(r)
        .filter((v) => typeof v !== "object")
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .filter((r) => !category || r.category === category)
    .filter((r) => !brand || r.brand === brand)
    .filter(
      (r) =>
        !filter ||
        (page === "products"
          ? filter === "Active"
            ? r.active
            : filter === "Inactive"
              ? !r.active
              : r.warehouse_qty <= r.min_stock
          : page === "sales"
            ? filter === "Paid"
              ? Number(r.paid) >= Number(r.total)
              : Number(r.paid) < Number(r.total)
            : page === "vehicles"
              ? r.status === filter
              : page === "payments"
                ? r.method === filter
                : true),
    );
  const filterOptions =
    page === "products"
      ? ["Active", "Inactive", "Low stock"]
      : page === "vehicles"
        ? [
            "AVAILABLE",
            "LOADED",
            { value: "ON ROUTE", label: "Dispatched" },
            "RETURNED",
            "RECONCILIATION",
            "CLOSED",
            "MAINTENANCE",
          ]
        : page === "sales"
          ? ["Paid", "Pending"]
          : page === "payments"
            ? ["CASH", "UPI", "BANK TRANSFER"]
            : [];
  const reset = () => {
    setQ("");
    setFilter("");
    setCategory("");
    setBrand("");
    setCursor(0);
  };
  return (
    <div className="stack">
      {page === "payments" && (
        <div className="stats">
          <Kpi
            title="Collected today"
            value={money(
              sum(
                s.payments.filter((p) => day(p.created_at) === day()),
                "amount",
              ),
            )}
            foot="Confirmed payments"
            icon={Wallet}
            tone="teal"
          />
          <Kpi
            title="Cash collected"
            value={money(
              sum(
                s.payments.filter((p) => p.method === "CASH"),
                "amount",
              ),
            )}
            foot="All recorded cash payments"
            icon={Coins}
          />
          <Kpi
            title="Digital payments"
            value={money(
              sum(
                s.payments.filter((p) => p.method !== "CASH"),
                "amount",
              ),
            )}
            foot="UPI and bank transfers"
            icon={Wallet}
          />
          <Kpi
            title="Outstanding credit"
            value={money(sum(s.customers, "balance"))}
            foot="Ready for collection"
            icon={Users}
            tone="amber"
          />
        </div>
      )}
      {page === "reconciliation" && (
        <div className="alert">
          <ClipboardCheck size={17} />
          HOLD keeps the remaining stock in the vehicle. UNLOAD returns all
          remaining stock to the warehouse.
        </div>
      )}
      <section className="clay panel">
        <div className="panel-head">
          <div className="page-title-row">
            <h2>{page === "reconciliation" ? "Closing history" : def.title}</h2>
            <span className="count-pill">{rows.length}</span>
          </div>
          <div className="flex-row">
            <Btn
              light
              disabled={!filtered.length}
              onClick={() =>
                exportCSV(
                  def.title,
                  filtered.map((r) =>
                    Object.fromEntries(
                      def.columns
                        .filter((c) => c.key !== "items")
                        .map((c) => [c.label, r[c.key] ?? ""]),
                    ),
                  ),
                )
              }
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </Btn>
            {def.action && can(s.user.role, def.action) && (
              <Btn onClick={() => open(def.action!)}>
                <Plus size={14} />
                {def.button}
              </Btn>
            )}
          </div>
        </div>
        <div className="toolbar">
          <div className="filter-search">
            <Search size={15} />
            <input
              className="input"
              aria-label={def.search}
              placeholder={def.search}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(0);
              }}
            />
          </div>
          {filterOptions.length > 0 && (
            <div className="filter-width">
              <Pick
                label="Filter status"
                value={filter}
                onChange={(v: string) => {
                  setFilter(v);
                  setCursor(0);
                }}
                options={filterOptions}
                placeholder="All statuses"
              />
            </div>
          )}
          {page === "products" && (
            <>
              <div className="filter-width">
                <Pick
                  label="Filter category"
                  value={category}
                  onChange={(v: string) => {
                    setCategory(v);
                    setCursor(0);
                  }}
                  options={[
                    ...new Set(
                      s.products.map((p) => p.category).filter(Boolean),
                    ),
                  ]}
                  placeholder="All categories"
                />
              </div>
              <div className="filter-width">
                <Pick
                  label="Filter brand"
                  value={brand}
                  onChange={(v: string) => {
                    setBrand(v);
                    setCursor(0);
                  }}
                  options={[
                    ...new Set(s.products.map((p) => p.brand).filter(Boolean)),
                  ]}
                  placeholder="All brands"
                />
              </div>
            </>
          )}
          {(q || filter || category || brand) && (
            <button className="text-link" onClick={reset}>
              Reset filters
            </button>
          )}
        </div>
        {!rows.length ? (
          <Empty
            icon={
              page === "vehicles"
                ? Truck
                : page === "sales"
                  ? ShoppingCart
                  : page === "payments"
                    ? Wallet
                    : Package
            }
            title={`No ${page === "reconciliation" ? "reconciliations" : def.title.toLowerCase()} yet`}
            description={
              page === "sales"
                ? "Load and dispatch a vehicle to record your first sale."
                : page === "loads"
                  ? "Receive products in the warehouse, then load your vehicle."
                  : `Your ${def.title.toLowerCase()} will appear here as you add real records.`
            }
            action={
              def.action && can(s.user.role, def.action)
                ? () => open(def.action!)
                : undefined
            }
            label={def.button}
          />
        ) : (
          <DataTable
            columns={def.columns}
            rows={filtered.slice(cursor * 20, cursor * 20 + 20)}
            empty="No records match your filters"
            onRow={(r) => detail(page, r)}
          />
        )}
        <div className="pagination">
          <span>
            {filtered.length
              ? `${cursor * 20 + 1}–${Math.min(cursor * 20 + 20, filtered.length)} of ${filtered.length}`
              : "0 records"}
          </span>
          {filtered.length > 20 && (
            <div className="flex-row">
              <Btn
                light
                disabled={cursor === 0}
                onClick={() => setCursor(cursor - 1)}
              >
                Previous
              </Btn>
              <Btn
                light
                disabled={(cursor + 1) * 20 >= filtered.length}
                onClick={() => setCursor(cursor + 1)}
              >
                Next
              </Btn>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
export function Inventory({ s, open, detail }: PageProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const low = s.products.filter(
    (p) => p.active && p.warehouse_qty <= p.min_stock,
  );
  return (
    <>
      <div className="stats">
        <Kpi
          title="Total stock"
          value={num(sum(s.products, "warehouse_qty") + sum(s.stock, "qty"))}
          foot="Warehouse and vehicles"
          icon={Box}
        />
        <Kpi
          title="Warehouse"
          value={num(sum(s.products, "warehouse_qty"))}
          foot="Available base units"
          icon={Warehouse}
        />
        <Kpi
          title="Vehicle stock"
          value={num(sum(s.stock, "qty"))}
          foot="Across your fleet"
          icon={Truck}
          tone="teal"
        />
        <Kpi
          title="Low stock products"
          value={low.length}
          foot={`${num(sum(s.products, "damaged_qty"))} damaged units recorded`}
          icon={AlertCircle}
          tone="amber"
        />
      </div>
      <section className="clay panel">
        <Tabs defaultValue="stock">
          <div className="panel-head">
            <TabsList>
              <TabsTrigger value="stock">Stock levels</TabsTrigger>
              <TabsTrigger value="movements">Stock movements</TabsTrigger>
              <TabsTrigger value="damage">Damage & loss</TabsTrigger>
            </TabsList>
            {can(s.user.role, "inventory") && (
              <Btn onClick={() => open("inventory")}>
                <Plus size={14} />
                Receive stock
              </Btn>
            )}
          </div>
          <TabsContent value="stock">
            <div className="toolbar">
              <div className="filter-search">
                <Search size={15} />
                <input
                  className="input"
                  placeholder="Search inventory..."
                  aria-label="Search inventory"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="filter-width">
                <Pick
                  label="Stock filter"
                  value={filter}
                  onChange={setFilter}
                  options={["Low stock", "In stock"]}
                  placeholder="All products"
                />
              </div>
            </div>
            <DataTable
              rows={s.products.filter(
                (p) =>
                  (p.name + " " + p.sku)
                    .toLowerCase()
                    .includes(q.toLowerCase()) &&
                  (!filter ||
                    (filter === "Low stock"
                      ? p.warehouse_qty <= p.min_stock
                      : p.warehouse_qty > 0)),
              )}
              columns={[
                {
                  key: "name",
                  label: "Product",
                  render: (p) => (
                    <>
                      <span className="list-title">{p.name}</span>
                      <p className="table-sub">{p.sku}</p>
                    </>
                  ),
                },
                {
                  key: "warehouse_qty",
                  label: "Warehouse",
                  render: (p) => num(p.warehouse_qty),
                },
                {
                  key: "vehicle_qty",
                  label: "Vehicles",
                  render: (p) => num(p.vehicle_qty),
                },
                {
                  key: "total",
                  label: "Total",
                  render: (p) => num(p.warehouse_qty + p.vehicle_qty),
                },
                { key: "min_stock", label: "Min level" },
                {
                  key: "status",
                  label: "Status",
                  render: (p) => (
                    <Badge>
                      {p.warehouse_qty <= p.min_stock ? "Low stock" : "Active"}
                    </Badge>
                  ),
                },
              ]}
              onRow={(p) => detail("products", p)}
              empty="Add products, then receive your first stock"
            />
          </TabsContent>
          <TabsContent value="movements">
            <DataTable
              rows={s.movements}
              columns={[
                {
                  key: "created_at",
                  label: "When",
                  render: (r) =>
                    `${date(r.created_at)} · ${time(r.created_at)}`,
                },
                { key: "product_name", label: "Product" },
                {
                  key: "kind",
                  label: "Movement",
                  render: (r) => <Badge>{r.kind}</Badge>,
                },
                { key: "vehicle_number", label: "Vehicle" },
                { key: "qty", label: "Base units" },
                {
                  key: "recorded_by",
                  label: "Recorded by",
                  render: (r) => r.recorded_by || "Not recorded",
                },
                { key: "notes", label: "Reference / reason" },
              ]}
              empty="No stock movements yet"
            />
          </TabsContent>
          <TabsContent value="damage">
            <div className="spread mb-4">
              <p className="muted small">
                Damaged warehouse stock and reconciliation shortages.
              </p>
              {can(s.user.role, "inventory") && (
                <Btn
                  light
                  onClick={() => open("inventory", { kind: "DAMAGE" })}
                >
                  Record damage
                </Btn>
              )}
            </div>
            <DataTable
              rows={s.movements.filter((m) =>
                ["DAMAGE", "LOSS"].includes(m.kind),
              )}
              columns={[
                {
                  key: "created_at",
                  label: "Date",
                  render: (r) => date(r.created_at),
                },
                { key: "product_name", label: "Product" },
                {
                  key: "kind",
                  label: "Type",
                  render: (r) => <Badge>{r.kind}</Badge>,
                },
                { key: "qty", label: "Units" },
                { key: "notes", label: "Reason" },
              ]}
              empty="No damage or loss recorded"
            />
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}
export function Detail({
  s,
  kind,
  row,
  close,
  open,
  save,
}: PageProps & { kind: string; row: Row; close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title =
    row.name ||
    row.number ||
    (kind === "sales"
      ? `INV-${String(row.invoice_no).padStart(6, "0")}`
      : kind === "payments"
        ? "Payment receipt"
        : kind === "loads"
          ? "Load confirmation"
          : "Vehicle reconciliation");
  async function perform(action: string, data: Row) {
    setBusy(true);
    setError("");
    try {
      await save(action, data);
      close();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const form = (k: string, r: Row = row) => {
    close();
    open(k, r);
  };
  return (
    <Sheet
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <SheetContent className="detail-sheet">
        <SheetHeader className="p-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {kind === "sales"
              ? "Confirmed sale and payment details"
              : `Your ${kind === "reconciliation" ? "closing" : kind.slice(0, -1)} record`}
          </SheetDescription>
        </SheetHeader>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {kind === "products" && (
          <>
            <div className="spread">
              <span className="muted small">
                {row.sku} · {row.brand || "No brand"}
              </span>
              <Badge>{row.active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="detail-grid">
              <div>
                <span>Warehouse stock</span>
                <b>{num(row.warehouse_qty)}</b>
              </div>
              <div>
                <span>Vehicle stock</span>
                <b>{num(row.vehicle_qty)}</b>
              </div>
              <div>
                <span>Selling price / base unit</span>
                <b>{money(row.price)}</b>
              </div>
              <div>
                <span>Minimum stock</span>
                <b>{num(row.min_stock)}</b>
              </div>
            </div>
            <h3>Packaging configuration</h3>
            <div className="details-list">
              <div>
                <span>Base unit</span>
                <b>{row.unit}</b>
              </div>
              <div>
                <span>1 box</span>
                <b>{row.box_size} base units</b>
              </div>
              <div>
                <span>1 carton</span>
                <b>{row.carton_size} base units</b>
              </div>
              <div>
                <span>Tax rate</span>
                <b>{row.tax_rate}%</b>
              </div>
              <div>
                <span>Category</span>
                <b>{row.category || "—"}</b>
              </div>
            </div>
            <h3>Sales performance</h3>
            <div className="compact-kpis">
              {[
                ["Today", 1],
                ["7 days", 7],
                ["30 days", 30],
              ].map(([label, n]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b>
                    {num(
                      s.sales
                        .filter(
                          (x) =>
                            new Date(x.created_at).getTime() >=
                              Date.now() - Number(n) * 86400000 &&
                            (n !== 1 || day(x.created_at) === day()),
                        )
                        .reduce(
                          (t, x) =>
                            t +
                            sum(
                              x.items.filter(
                                (i: Row) => i.product_id === row.id,
                              ),
                              "qty",
                            ),
                          0,
                        ),
                    )}
                  </b>
                </div>
              ))}
            </div>
            <div className="detail-actions mt-4">
              {can(s.user.role, "product") && (
                <Btn onClick={() => form("product")}>Edit product</Btn>
              )}
              {can(s.user.role, "inventory") && (
                <Btn
                  light
                  onClick={() => form("inventory", { product_id: row.id })}
                >
                  Receive stock
                </Btn>
              )}
            </div>
          </>
        )}
        {kind === "vehicles" && (
          <>
            <div className="spread">
              <p className="muted">{row.type}</p>
              <Badge>{row.status}</Badge>
            </div>
            <div className="details-list">
              <div>
                <span>Salesman</span>
                <b>{row.salesman_name || "Unassigned"}</b>
              </div>
              <div>
                <span>Active vehicle day</span>
                <b>{row.active_day || "Not started"}</b>
              </div>
            </div>
            <StockFlow summary={stockSummary(s, row.id)} />
            {row.status === "CLOSED" && (
              <div className="alert">
                <ShieldCheck size={17} />
                Next day's opening stock: {num(row.stock_qty)} units
              </div>
            )}
            <DataTable
              rows={s.stock
                .filter((x) => x.vehicle_id === row.id && x.qty > 0)
                .map((x) => ({
                  ...x,
                  name: s.products.find((p) => p.id === x.product_id)?.name,
                }))}
              columns={[
                { key: "name", label: "Product" },
                { key: "qty", label: "Remaining base units" },
              ]}
              empty="This vehicle has no remaining stock"
            />
            <div className="detail-actions">
              {can(s.user.role, "start_day") &&
                row.status === "CLOSED" &&
                row.active_day < day() &&
                row.stock_qty > 0 && (
                  <Btn
                    busy={busy}
                    onClick={() => perform("start_day", { vehicle_id: row.id })}
                  >
                    Start day with held stock
                  </Btn>
                )}
              {can(s.user.role, "load") &&
                ["AVAILABLE", "CLOSED", "LOADED"].includes(row.status) && (
                  <Btn onClick={() => form("load", { vehicle_id: row.id })}>
                    Create load
                  </Btn>
                )}
              {can(s.user.role, "vehicle_status") &&
                row.status === "LOADED" && (
                  <Btn
                    busy={busy}
                    onClick={() =>
                      perform("vehicle_status", {
                        vehicle_id: row.id,
                        status: "ON ROUTE",
                      })
                    }
                  >
                    Dispatch vehicle
                  </Btn>
                )}
              {can(s.user.role, "vehicle_status") &&
                row.status === "ON ROUTE" && (
                  <Btn
                    busy={busy}
                    onClick={() =>
                      perform("vehicle_status", {
                        vehicle_id: row.id,
                        status: "RETURNED",
                      })
                    }
                  >
                    Mark returned
                  </Btn>
                )}
              {can(s.user.role, "reconcile") &&
                ["LOADED", "ON ROUTE", "RETURNED", "RECONCILIATION"].includes(
                  row.status,
                ) && (
                  <Btn
                    light
                    onClick={() => form("reconcile", { vehicle_id: row.id })}
                  >
                    Reconcile
                  </Btn>
                )}
              {can(s.user.role, "vehicle") &&
                ["AVAILABLE", "CLOSED", "MAINTENANCE"].includes(row.status) && (
                  <Btn light onClick={() => form("vehicle")}>
                    Edit vehicle
                  </Btn>
                )}
              {can(s.user.role, "vehicle_status") &&
                ["AVAILABLE", "CLOSED", "MAINTENANCE"].includes(row.status) && (
                  <Btn
                    light
                    busy={busy}
                    disabled={row.stock_qty > 0}
                    onClick={() =>
                      perform("vehicle_status", {
                        vehicle_id: row.id,
                        status:
                          row.status === "MAINTENANCE"
                            ? "AVAILABLE"
                            : "MAINTENANCE",
                      })
                    }
                  >
                    {row.status === "MAINTENANCE"
                      ? "Mark available"
                      : "Set maintenance"}
                  </Btn>
                )}
            </div>
          </>
        )}
        {kind === "sales" && (
          <>
            <div className="details-list">
              <div>
                <span>Customer</span>
                <b>{row.customer_name}</b>
              </div>
              <div>
                <span>Vehicle</span>
                <b>{row.vehicle_number}</b>
              </div>
              <div>
                <span>Date</span>
                <b>
                  {date(row.created_at)} · {time(row.created_at)}
                </b>
              </div>
              <div>
                <span>Payment status</span>
                <Badge>
                  {Number(row.paid) >= Number(row.total) ? "Paid" : "Pending"}
                </Badge>
              </div>
            </div>
            <DataTable
              rows={row.items}
              columns={[
                { key: "name", label: "Product" },
                { key: "qty", label: "Units" },
                {
                  key: "price",
                  label: "Unit price",
                  render: (r) => money(r.price),
                },
                {
                  key: "subtotal",
                  label: "Subtotal",
                  render: (r) => money(r.subtotal),
                },
              ]}
            />
            <div className="total-box">
              {[
                ["Subtotal", row.subtotal],
                ["Discount", -row.discount],
                ["Tax", row.tax],
                ["Total", row.total],
                ["Paid", row.paid],
                ["Outstanding", row.total - row.paid],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className={`spread ${k === "Total" ? "grand" : ""}`}
                >
                  <span>{k}</span>
                  <b>{money(v)}</b>
                </div>
              ))}
            </div>
            <div className="detail-actions">
              <Btn light onClick={() => printInvoice(s, row)}>
                Print invoice / PDF
              </Btn>
              {can(s.user.role, "payment") && row.total > row.paid && (
                <Btn
                  onClick={() =>
                    form("payment", { customer_id: row.customer_id })
                  }
                >
                  Collect payment
                </Btn>
              )}
            </div>
          </>
        )}
        {kind === "payments" && (
          <>
            <div className="success-card">
              <ShieldCheck size={40} className="mx-auto text-teal-600 mb-4" />
              <h2>{money(row.amount)}</h2>
              <p className="muted">Payment received from {row.customer_name}</p>
            </div>
            <div className="details-list">
              <div>
                <span>Method</span>
                <b>{row.method}</b>
              </div>
              <div>
                <span>Reference</span>
                <b>{row.reference || "—"}</b>
              </div>
              <div>
                <span>Date</span>
                <b>
                  {date(row.created_at)} · {time(row.created_at)}
                </b>
              </div>
            </div>
          </>
        )}
        {(kind === "loads" || kind === "reconciliation") && (
          <>
            <div className="alert">
              <Check size={16} />
              {kind === "loads"
                ? "Load confirmed"
                : `${row.decision} confirmed`}{" "}
              · {row.vehicle_number}
            </div>
            <p className="small muted">
              {date(row.created_at)} · {time(row.created_at)}
            </p>
            <DataTable
              rows={row.items}
              columns={
                kind === "loads"
                  ? [
                      { key: "name", label: "Product" },
                      { key: "qty", label: "Loaded units" },
                      { key: "unit", label: "Base unit" },
                    ]
                  : [
                      { key: "name", label: "Product" },
                      { key: "expected", label: "Expected" },
                      { key: "physical", label: "Physical" },
                    ]
              }
            />
            <div className="total-box">
              <div className="spread">
                <span>Total units</span>
                <b>{num(row.qty)}</b>
              </div>
              {kind === "reconciliation" && (
                <div className="spread">
                  <span>Closing vehicle stock</span>
                  <b>{row.decision === "HOLD" ? num(row.qty) : 0}</b>
                </div>
              )}
            </div>
            {row.notes && <p className="muted">{row.notes}</p>}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
function printInvoice(s: State, r: Row) {
  const win = window.open("", "_blank");
  if (!win) return;
  const escape = (v: any) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  win.document.write(
    `<!doctype html><html><head><title>Invoice ${escape(r.invoice_no)}</title><style>body{font:14px system-ui;color:#253449;margin:50px}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{padding:14px;text-align:left;border-bottom:1px solid #dde3eb}.total{text-align:right;line-height:2}</style></head><body><h1>${escape(s.settings?.business_name || "Sanket Distribution")}</h1><p>${escape(s.settings?.address || "")}<br>${escape(s.settings?.gstin || "")}</p><h2>INV-${String(r.invoice_no).padStart(6, "0")}</h2><p>${escape(r.customer_name)} · ${escape(date(r.created_at))}</p><table><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Subtotal</th></tr>${r.items.map((i: Row) => `<tr><td>${escape(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.subtotal)}</td></tr>`).join("")}</table><div class="total">Subtotal: ${money(r.subtotal)}<br>Discount: ${money(r.discount)}<br>Tax: ${money(r.tax)}<br><b>Total: ${money(r.total)}</b><br>Paid: ${money(r.paid)}<br>Outstanding: ${money(r.total - r.paid)}</div></body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
export function Notifications({ s, go, save }: PageProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = notifications(s);
  return (
    <section className="clay panel">
      <div className="panel-head">
        <div>
          <h2>Notifications</h2>
          <p>{rows.filter((r) => !r.read).length} unread updates</p>
        </div>
        <Btn
          light
          busy={busy}
          disabled={!rows.some((r) => !r.read)}
          onClick={async () => {
            setBusy(true);
            try {
              await save("mark_read", {
                keys: rows.filter((r) => !r.read).map((r) => r.id),
              });
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check size={14} />
          Mark all read
        </Btn>
      </div>
      {error && <div className="alert error">{error}</div>}
      {rows.length ? (
        rows.map((r) => (
          <div
            className={`notification-row ${r.read ? "read" : ""}`}
            key={r.id}
          >
            <span className="kpi-icon">
              <Activity size={17} />
            </span>
            <div>
              <h3>{r.type.charAt(0).toUpperCase() + r.type.slice(1)}</h3>
              <p className="muted small">{r.message}</p>
              {"created_at" in r && (
                <span className="small muted">{date(r.created_at)}</span>
              )}
            </div>
            <button className="text-link" onClick={() => go(r.page)}>
              View
            </button>
          </div>
        ))
      ) : (
        <Empty
          icon={ShieldCheck}
          title="You're all caught up"
          description="Stock, payment and vehicle updates will arrive here."
        />
      )}
    </section>
  );
}
export function SettingsPage({ s, open }: PageProps) {
  return (
    <div className="stack">
      <section className="clay panel">
        <div className="panel-head">
          <div>
            <h2>Business settings</h2>
            <p>Details used on your invoices and workspace</p>
          </div>
          <Btn light onClick={() => open("settings", s.settings || undefined)}>
            Edit settings
          </Btn>
        </div>
        <div className="details-list">
          <div>
            <span>Business name</span>
            <b>{s.settings?.business_name || "Not configured"}</b>
          </div>
          <div>
            <span>Warehouse</span>
            <b>{s.settings?.warehouse_name || "Not configured"}</b>
          </div>
          <div>
            <span>Address</span>
            <b>{s.settings?.address || "—"}</b>
          </div>
          <div>
            <span>Phone</span>
            <b>{s.settings?.phone || "—"}</b>
          </div>
          <div>
            <span>GSTIN</span>
            <b>{s.settings?.gstin || "—"}</b>
          </div>
          <div>
            <span>Currency / timezone</span>
            <b>INR · Asia/Kolkata</b>
          </div>
        </div>
      </section>
      <section className="clay panel">
        <div className="panel-head">
          <div>
            <h2>Team & access</h2>
            <p>
              Workers manage warehouse stock, every vehicle and sales. Only the
              owner manages team access and reviews daily reports.
            </p>
          </div>
          <Btn onClick={() => open("user")}>
            <Plus size={14} />
            Add member
          </Btn>
        </div>
        <DataTable
          rows={s.users}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Sign-in email" },
            { key: "role", label: "Role", render: (r) => roleNames[r.role] },
            {
              key: "active",
              label: "Status",
              render: (r) => <Badge>{r.active ? "Active" : "Inactive"}</Badge>,
            },
            {
              key: "action",
              label: "Manage",
              render: (r) =>
                r.role === "owner" ? (
                  <span className="muted small">Owner</span>
                ) : (
                  <div className="flex-row flex-wrap">
                    <button
                      className="text-link"
                      onClick={() => open("user", r)}
                    >
                      Edit member
                    </button>
                    <InviteButton user={r} />
                  </div>
                ),
            },
          ]}
          empty="No team members added"
        />
        <p className="form-help mt-4">
          Add a member, then create an access link for them to choose a
          password. Use a new access link to reset a forgotten password.
          Inactive accounts cannot sign in.
        </p>
      </section>
      <section className="clay panel">
        <div className="flex-row">
          <ShieldCheck size={23} />
          <div>
            <h3>Connected to PostgreSQL</h3>
            <p className="muted small">
              Business records stay in your database. Every stock transfer is
              committed atomically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
