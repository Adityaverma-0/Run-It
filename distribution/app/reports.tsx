"use client";
import { useState } from "react";
import {
  FileText,
  Download,
  Printer,
  ChartNoAxesCombined,
  Truck,
  Users,
  Package,
  Warehouse,
  Wallet,
  ClipboardCheck,
  Activity,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Btn, Pick, Field, DataTable, Empty } from "./ui";
import { money, num, day, date, sum, exportCSV, type Row } from "@/lib/client";
import type { PageProps } from "./pages";
const reports = [
  ["daily", "Daily sales", "Sales and revenue by day", ChartNoAxesCombined],
  ["vehicle", "Vehicle sales", "Sales performance across the fleet", Truck],
  [
    "salesman",
    "Salesman performance",
    "Revenue and orders by representative",
    Users,
  ],
  ["product", "Product sales", "Quantities and sales by product", Package],
  ["warehouse", "Warehouse stock", "Current available stock", Warehouse],
  ["outstanding", "Customer outstanding", "Credit balances and limits", Users],
  ["payments", "Payment collection", "Cash, UPI and bank receipts", Wallet],
  [
    "reconciliation",
    "Vehicle reconciliation",
    "HOLD, UNLOAD and closing counts",
    ClipboardCheck,
  ],
  ["movement", "Stock movement", "A complete inventory audit trail", Activity],
  ["low", "Low stock", "Products at or below minimum", AlertCircle],
  [
    "damage",
    "Damage / loss",
    "Damage and reconciliation shortages",
    ShieldAlert,
  ],
] as const;
export default function Reports({ s }: PageProps) {
  const [selected, setSelected] = useState("daily");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return day(d);
  });
  const [to, setTo] = useState(day());
  const [vehicle, setVehicle] = useState("");
  const [salesman, setSalesman] = useState("");
  const [product, setProduct] = useState("");
  const [customer, setCustomer] = useState("");
  const inDate = (r: Row) =>
    day(r.created_at) >= from && day(r.created_at) <= to;
  const matches = (r: Row) =>
    inDate(r) &&
    (!vehicle || r.vehicle_id === vehicle) &&
    (!salesman || r.salesman_id === salesman) &&
    (!customer || r.customer_id === customer) &&
    (!product || r.items?.some((i: Row) => i.product_id === product));
  const sales = s.sales.filter(matches);
  let rows: Row[] = [];
  const aggregate = (key: string, label: string) => {
    const groups: Record<string, Row> = {};
    for (const sale of sales) {
      const v =
        key === "date" ? day(sale.created_at) : sale[key] || "Unassigned";
      groups[v] ??= {
        [label]: v,
        Orders: 0,
        Sales: 0,
        Paid: 0,
        Outstanding: 0,
      };
      groups[v].Orders++;
      groups[v].Sales += Number(sale.total);
      groups[v].Paid += Number(sale.paid);
      groups[v].Outstanding += Number(sale.total) - Number(sale.paid);
    }
    return Object.values(groups);
  };
  if (selected === "daily") rows = aggregate("date", "Date");
  if (selected === "vehicle") rows = aggregate("vehicle_number", "Vehicle");
  if (selected === "salesman") rows = aggregate("salesman_name", "Salesman");
  if (selected === "product") {
    const groups: Record<string, Row> = {};
    for (const sale of sales)
      for (const i of sale.items) {
        if (product && i.product_id !== product) continue;
        groups[i.product_id] ??= { Product: i.name, Units: 0, Subtotal: 0 };
        groups[i.product_id].Units += i.qty;
        groups[i.product_id].Subtotal += Number(i.subtotal);
      }
    rows = Object.values(groups).sort((a, b) => b.Subtotal - a.Subtotal);
  }
  if (["warehouse", "low"].includes(selected))
    rows = s.products
      .filter(
        (p) =>
          (!product || p.id === product) &&
          (selected !== "low" || (p.active && p.warehouse_qty <= p.min_stock)),
      )
      .map((p) => ({
        SKU: p.sku,
        Product: p.name,
        "Base unit": p.unit,
        Warehouse: p.warehouse_qty,
        Vehicles: p.vehicle_qty,
        Total: p.warehouse_qty + p.vehicle_qty,
        Minimum: p.min_stock,
      }));
  if (selected === "outstanding")
    rows = s.customers
      .filter((c) => Number(c.balance) > 0 && (!customer || c.id === customer))
      .map((c) => ({
        Customer: c.name,
        Phone: c.phone,
        Outstanding: Number(c.balance),
        "Credit limit": Number(c.credit_limit),
      }));
  if (selected === "payments")
    rows = s.payments
      .filter(
        (p) =>
          inDate(p) &&
          (!customer || p.customer_id === customer) &&
          (!salesman || p.created_by === salesman) &&
          (!vehicle ||
            s.sales.some(
              (x) => x.id === p.sale_id && x.vehicle_id === vehicle,
            )) &&
          (!product ||
            s.sales.some(
              (x) =>
                x.id === p.sale_id &&
                x.items.some((i: Row) => i.product_id === product),
            )),
      )
      .map((p) => ({
        Date: date(p.created_at),
        Customer: p.customer_name,
        Amount: Number(p.amount),
        Method: p.method,
        Reference: p.reference,
      }));
  if (selected === "reconciliation")
    rows = s.reconciliations
      .filter(
        (r) =>
          inDate(r) &&
          (!vehicle || r.vehicle_id === vehicle) &&
          (!salesman ||
            s.vehicles.find((v) => v.id === r.vehicle_id)?.salesman_id ===
              salesman) &&
          (!product || r.items.some((i: Row) => i.product_id === product)),
      )
      .map((r) => ({
        Day: r.day,
        Vehicle: r.vehicle_number,
        Decision: r.decision,
        Units: r.qty,
        Loss: r.variance,
        Notes: r.notes,
      }));
  if (["movement", "damage"].includes(selected))
    rows = s.movements
      .filter(
        (m) =>
          inDate(m) &&
          (!vehicle || m.vehicle_id === vehicle) &&
          (!product || m.product_id === product) &&
          (!salesman ||
            s.vehicles.find((v) => v.id === m.vehicle_id)?.salesman_id ===
              salesman) &&
          (selected !== "damage" || ["DAMAGE", "LOSS"].includes(m.kind)),
      )
      .map((m) => ({
        Date: date(m.created_at),
        Product: m.product_name,
        Movement: m.kind,
        Vehicle: m.vehicle_number || "Warehouse",
        Units: m.qty,
        Notes: m.notes,
      }));
  const allowed = s.user.role.startsWith("warehouse")
    ? ["warehouse", "reconciliation", "movement", "low", "damage"]
    : s.user.role === "accountant"
      ? ["daily", "vehicle", "salesman", "product", "outstanding", "payments"]
      : reports.map((x) => x[0]);
  const visible = reports.filter((r) => allowed.includes(r[0]));
  const actual = allowed.includes(selected) ? selected : allowed[0];
  if (actual !== selected) {
    setSelected(actual);
    return null;
  }
  const title = reports.find((r) => r[0] === selected)?.[1];
  const currencyCols = [
    "Sales",
    "Paid",
    "Outstanding",
    "Subtotal",
    "Amount",
    "Credit limit",
  ];
  const columns = rows.length
    ? Object.keys(rows[0]).map((k) => ({
        key: k,
        label: k,
        render: (r: Row) =>
          currencyCols.includes(k)
            ? money(r[k])
            : typeof r[k] === "number"
              ? num(r[k])
              : r[k],
      }))
    : [];
  const chartKey = selected === "product" ? "Subtotal" : "Sales";
  const options = (items: Row[], key = "name") =>
    items.map((r) => ({ value: r.id, label: r[key] }));
  const dated = !["warehouse", "low", "outstanding"].includes(selected);
  const salesReport = ["daily", "vehicle", "salesman", "product"].includes(
    selected,
  );
  return (
    <div className="stack">
      <div className="grid3 no-print">
        {visible.map(([id, title, description, Icon]) => (
          <button
            key={id}
            className={`clay report-card ${selected === id ? "report-selected" : ""}`}
            onClick={() => {
              setSelected(id);
              setVehicle("");
              setSalesman("");
              setProduct("");
              setCustomer("");
            }}
          >
            <Icon size={23} />
            <h3>{title}</h3>
            <p>{description}</p>
          </button>
        ))}
      </div>
      <section className="clay panel">
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            <p className="muted small">
              {dated
                ? `${date(from + "T00:00:00+05:30")} – ${date(to + "T00:00:00+05:30")}`
                : "Current database balances"}
            </p>
          </div>
          <div className="flex-row no-print">
            <Btn
              light
              disabled={!rows.length}
              onClick={() => exportCSV(title || "Report", rows)}
            >
              <Download size={14} />
              CSV
            </Btn>
            <Btn light disabled={!rows.length} onClick={() => window.print()}>
              <Printer size={14} />
              Export PDF
            </Btn>
          </div>
        </div>
        <div className="report-filters no-print">
          {dated && (
            <>
              <Field
                label="From date"
                type="date"
                value={from}
                max={to}
                onChange={(e: any) => setFrom(e.target.value)}
              />
              <Field
                label="To date"
                type="date"
                value={to}
                min={from}
                onChange={(e: any) => setTo(e.target.value)}
              />
            </>
          )}
          {!["warehouse", "low", "outstanding"].includes(selected) && (
            <Field label="Vehicle">
              <Pick
                label="Vehicle filter"
                value={vehicle}
                onChange={setVehicle}
                options={options(s.vehicles, "number")}
                placeholder="All vehicles"
              />
            </Field>
          )}
          {!["warehouse", "low", "outstanding"].includes(selected) && (
            <Field label="Salesman">
              <Pick
                label="Salesman filter"
                value={salesman}
                onChange={setSalesman}
                options={options(
                  s.users.filter((u) =>
                    ["salesman", "worker"].includes(u.role),
                  ),
                )}
                placeholder="All salesmen"
              />
            </Field>
          )}
          {selected !== "outstanding" && (
            <Field label="Product">
              <Pick
                label="Product filter"
                value={product}
                onChange={setProduct}
                options={options(s.products)}
                placeholder="All products"
              />
            </Field>
          )}
          {(salesReport || ["payments", "outstanding"].includes(selected)) && (
            <Field label="Customer">
              <Pick
                label="Customer filter"
                value={customer}
                onChange={setCustomer}
                options={options(s.customers)}
                placeholder="All customers"
              />
            </Field>
          )}
        </div>
        {salesReport && rows.length > 0 && (
          <div className="chart-wrap mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid vertical={false} stroke="#dce5ee" />
                <XAxis
                  dataKey={Object.keys(rows[0])[0]}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => money(v)} />
                <Bar
                  dataKey={chartKey}
                  fill="#668eaa"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <DataTable
          rows={rows}
          columns={columns}
          empty="No records for these filters"
        />
        <p className="form-help mt-4">
          {rows.length} records · Generated {date(new Date())} · Currency INR.
          PDF export opens your browser's print dialog.
        </p>
      </section>
    </div>
  );
}
