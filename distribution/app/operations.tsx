"use client";
import { useEffect, useState, useRef } from "react";
import {
  Package,
  Truck,
  ShoppingCart,
  Warehouse,
  Tags,
  ClipboardCheck,
  Plus,
  Download,
  Printer,
  RefreshCw,
  Users,
  Coins,
  Wallet,
  Check,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  Btn,
  Kpi,
  Empty,
  DataTable,
  Badge,
  Field,
  Pick,
  Modal,
  StockFlow,
} from "./ui";
import {
  day,
  date,
  time,
  num,
  money,
  sum,
  roleNames,
  can,
  exportCSV,
  stockSummary,
  type Row,
} from "@/lib/client";
import type { PageProps } from "./pages";

export function WorkerDashboard({ s, go, open, detail }: PageProps) {
  const today = day();
  const todaySales = s.sales.filter((r) => day(r.created_at) === today);
  const todayLoads = s.loads.filter((r) => day(r.created_at) === today);
  return (
    <div className="stack">
      <section className="clay panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">WORKER WORKSPACE</span>
            <h2 className="mt-2">Your day, from stock to sale.</h2>
            <p>
              Manage warehouse stock and every vehicle. Confirmed updates are
              shared with your admin.
            </p>
          </div>
          <Btn light onClick={() => go("daily-reports")}>
            <ClipboardCheck size={16} />
            Daily report
          </Btn>
        </div>
        <div className="worker-actions">
          {[
            ["inventory", "Receive stock", Warehouse],
            ["load", "Load a vehicle", Truck],
            ["sale", "Record a sale", ShoppingCart],
            ["product", "Add product", Package],
            ["item_type", "Add item type", Tags],
            ["reconcile", "Close vehicle day", ClipboardCheck],
          ].map(([action, label, Icon]: any) => (
            <button
              key={action}
              className="clay action-tile"
              onClick={() => open(action)}
            >
              <Icon size={22} />
              <b>{label}</b>
            </button>
          ))}
        </div>
      </section>
      <div className="stats">
        <Kpi
          title="Warehouse stock"
          value={num(sum(s.products, "warehouse_qty"))}
          foot="Available base units"
          icon={Warehouse}
        />
        <Kpi
          title="Vehicle stock"
          value={num(sum(s.stock, "qty"))}
          foot="Across all vehicles"
          icon={Truck}
        />
        <Kpi
          title="Loaded today"
          value={num(sum(todayLoads, "qty"))}
          foot={`${todayLoads.length} confirmed loads`}
          icon={Package}
          tone="teal"
        />
        <Kpi
          title="Sales today"
          value={money(sum(todaySales, "total"))}
          foot={`${todaySales.length} confirmed orders`}
          icon={Coins}
          tone="teal"
        />
      </div>
      <section className="clay panel">
        <div className="panel-head">
          <div>
            <h2>Vehicle operations</h2>
            <p>Choose a vehicle to load, dispatch, sell or reconcile</p>
          </div>
          <Btn light onClick={() => open("vehicle")}>
            <Plus size={15} />
            Add vehicle
          </Btn>
        </div>
        {!s.vehicles.length ? (
          <Empty
            icon={Truck}
            title="No vehicles yet"
            description="Add your first vehicle and assign a worker or sales representative."
          />
        ) : (
          <div className="grid3">
            {s.vehicles.map((v) => (
              <article className="clay stock-card" key={v.id}>
                <div className="spread">
                  <h3>{v.number}</h3>
                  <Badge>{v.status}</Badge>
                </div>
                <p className="small muted">
                  {v.salesman_name || "Unassigned"} ·{" "}
                  {v.route_name || "No route"}
                </p>
                <StockFlow summary={stockSummary(s, v.id)} />
                <div className="flex-row flex-wrap">
                  <Btn light onClick={() => detail("vehicles", v)}>
                    Manage vehicle
                  </Btn>
                  {v.status === "ON ROUTE" && (
                    <Btn onClick={() => open("sale", { vehicle_id: v.id })}>
                      New sale
                    </Btn>
                  )}
                  {["AVAILABLE", "LOADED", "CLOSED"].includes(v.status) && (
                    <Btn onClick={() => open("load", { vehicle_id: v.id })}>
                      Load stock
                    </Btn>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <AdminDailyPanel s={s} go={go} />
      <section className="clay panel">
        <div className="panel-head">
          <div>
            <h2>Your recent updates</h2>
            <p>Only transactions confirmed by the server appear here</p>
          </div>
          <Btn light onClick={() => go("sync")}>
            Sync center
          </Btn>
        </div>
        <DataTable
          rows={s.activity
            .filter((r) => r.created_by === s.user.id)
            .slice(0, 8)}
          columns={[
            {
              key: "created_at",
              label: "Time",
              render: (r) => `${date(r.created_at)} · ${time(r.created_at)}`,
            },
            { key: "message", label: "Update" },
          ]}
          empty="Your confirmed updates will appear here"
        />
      </section>
    </div>
  );
}

export function AdminDailyPanel({
  s,
  go,
}: {
  s: PageProps["s"];
  go: PageProps["go"];
}) {
  const reports = s.dailyReports || [];
  const pending = reports.filter((r) => !r.reviewed_at);
  const todayMovements = s.movements.filter((m) => day(m.created_at) === day());
  const owner = s.user.role === "owner";
  return (
    <section className="clay panel daily-overview">
      <div className="panel-head">
        <div>
          <span className="eyebrow">DAILY OPERATIONS</span>
          <h2 className="mt-2">
            {owner
              ? "Worker updates & daily reports"
              : "Share your daily report"}
          </h2>
          <p>
            {owner
              ? `${pending.length} submissions awaiting review · Dashboard refreshes every 20 seconds while open`
              : "Review today's confirmed sales and stock, then submit a snapshot to the admin."}
          </p>
        </div>
        <Btn onClick={() => go("daily-reports")}>
          <ClipboardCheck size={16} />
          Open daily report
        </Btn>
      </div>
      <div className="daily-metrics">
        {[
          [
            "Received today",
            sum(
              todayMovements.filter((m) => m.kind === "RECEIPT"),
              "qty",
            ),
          ],
          [
            "Loaded today",
            sum(
              todayMovements.filter((m) => m.kind === "LOAD"),
              "qty",
            ),
          ],
          [
            "Sold today",
            sum(
              todayMovements.filter((m) => m.kind === "SALE"),
              "qty",
            ),
          ],
          [
            "Returned today",
            sum(
              todayMovements.filter((m) => m.kind === "UNLOAD"),
              "qty",
            ),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="muted small">{label}</span>
            <strong>{num(value)}</strong>
            <span className="muted small">base units</span>
          </div>
        ))}
      </div>
      <DataTable
        rows={reports.slice(0, 5)}
        columns={[
          {
            key: "report_day",
            label: "Day",
            render: (r) => date(r.report_day),
          },
          { key: "submitted_by_name", label: "Submitted by" },
          { key: "revision", label: "Version" },
          {
            key: "reviewed_at",
            label: "Status",
            render: (r) => (
              <Badge>{r.reviewed_at ? "Reviewed" : "Pending"}</Badge>
            ),
          },
        ]}
        empty={
          owner
            ? "No worker reports submitted yet"
            : "You have not submitted a report yet"
        }
      />
    </section>
  );
}

export function ItemTypes({ s, open }: PageProps) {
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const rows = (s.itemTypes || []).filter(
    (t) =>
      (!kind || t.kind === kind) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="clay panel">
      <div className="panel-head">
        <div>
          <h2>Categories & packaging units</h2>
          <p>
            Create the item types your business actually uses. New types also
            appear when you save a product.
          </p>
        </div>
        {can(s.user.role, "item_type") && (
          <Btn onClick={() => open("item_type")}>
            <Plus size={16} />
            Add item type
          </Btn>
        )}
      </div>
      <div className="toolbar">
        <Field
          label="Find item type"
          type="search"
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
        />
        <Pick
          label="Type filter"
          value={kind}
          onChange={setKind}
          options={[
            { value: "category", label: "Product categories" },
            { value: "unit", label: "Packaging units" },
          ]}
          placeholder="All item types"
        />
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "name", label: "Name" },
          {
            key: "kind",
            label: "Type",
            render: (r) =>
              r.kind === "category" ? "Product category" : "Packaging unit",
          },
          {
            key: "products",
            label: "Products using this type",
            render: (r) =>
              s.products.filter(
                (p) =>
                  String(p[r.kind === "category" ? "category" : "unit"])
                    .trim()
                    .toLowerCase() === r.name.toLowerCase(),
              ).length,
          },
          {
            key: "edit",
            label: "Manage",
            render: (r) =>
              can(s.user.role, "item_type") ? (
                <button
                  className="text-link"
                  onClick={() => open("item_type", r)}
                >
                  Edit name
                </button>
              ) : (
                "—"
              ),
          },
        ]}
        empty="No matching item types"
      />
    </section>
  );
}

const stockColumns = [
  { key: "name", label: "Product" },
  { key: "category", label: "Category" },
  { key: "unit", label: "Unit" },
  { key: "opening_warehouse", label: "Opening warehouse" },
  { key: "received", label: "Received" },
  { key: "loaded", label: "Loaded" },
  { key: "opening_vehicle", label: "Opening vehicle" },
  { key: "sold", label: "Sold" },
  { key: "unloaded", label: "Unloaded" },
  { key: "damaged", label: "Warehouse damage" },
  { key: "lost", label: "Vehicle loss" },
  { key: "closing_warehouse", label: "Closing warehouse" },
  { key: "closing_vehicle", label: "Closing vehicle" },
];
const workerColumns = [
  { key: "name", label: "Recorded by" },
  { key: "role", label: "Role", render: (r: Row) => roleNames[r.role] },
  { key: "orders", label: "Orders" },
  { key: "sales", label: "Sales", render: (r: Row) => money(r.sales) },
  {
    key: "collections",
    label: "Collected",
    render: (r: Row) => money(r.collections),
  },
  { key: "received", label: "Received" },
  { key: "loaded", label: "Loaded" },
  { key: "sold", label: "Sold" },
  { key: "updates", label: "Updates" },
];
function ReportTables({ summary, tab }: { summary: Row; tab: string }) {
  if (tab === "stock")
    return (
      <DataTable
        rows={summary.stock}
        columns={stockColumns}
        empty="No stock records for this day"
      />
    );
  if (tab === "workers")
    return (
      <DataTable
        rows={summary.workers}
        columns={workerColumns}
        empty="No team activity recorded for this day"
      />
    );
  return (
    <DataTable
      rows={summary.sales}
      columns={[
        {
          key: "invoice_no",
          label: "Invoice",
          render: (r) => `INV-${String(r.invoice_no).padStart(6, "0")}`,
        },
        { key: "customer_name", label: "Customer" },
        { key: "vehicle_number", label: "Vehicle" },
        { key: "recorded_by", label: "Recorded by" },
        { key: "total", label: "Sales", render: (r) => money(r.total) },
        { key: "created_at", label: "Time", render: (r) => time(r.created_at) },
      ]}
      empty="No sales recorded for this day"
    />
  );
}

export function DailyReports({ s, save, pendingCount = 0 }: PageProps) {
  const [selectedDay, setDay] = useState(day());
  const [data, setData] = useState<{ summary: Row; submissions: Row[] } | null>(
    null,
  );
  const [tab, setTab] = useState("stock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [notes, setNotes] = useState("");
  const [view, setView] = useState<Row | null>(null);
  const loadedDay = useRef("");
  const owner = s.user.role === "owner";
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (loadedDay.current !== selectedDay) setData(null);
    loadedDay.current = selectedDay;
    fetch(`/api/daily-report?day=${encodeURIComponent(selectedDay)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const body: any = await r.json();
        if (!r.ok) throw new Error(body.error || "Unable to load the report");
        return body;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedDay, s.serverTime, retry]);
  async function run(action: string, payload: Row) {
    setBusy(true);
    setError("");
    try {
      await save(action, payload);
      setConfirm(false);
      setView(null);
      setRetry((r) => r + 1);
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  const summary = data?.summary;
  const own = data?.submissions.find((r) => r.submitted_by === s.user.id);
  function download() {
    if (!summary) return;
    const columns =
      tab === "stock"
        ? stockColumns
        : tab === "workers"
          ? workerColumns
          : [
              { key: "invoice_no", label: "Invoice" },
              { key: "customer_name", label: "Customer" },
              { key: "vehicle_number", label: "Vehicle" },
              { key: "recorded_by", label: "Recorded by" },
              { key: "total", label: "Sales" },
            ];
    exportCSV(
      `Daily-${tab}-${selectedDay}`,
      summary[tab].map((r: Row) =>
        Object.fromEntries(columns.map((c) => [c.label, r[c.key]])),
      ),
    );
  }
  return (
    <div className="stack daily-report-view">
      <section className="clay panel">
        <div className="panel-head">
          <div>
            <h2>Daily sales & stock report</h2>
            <p>
              {date(selectedDay)} · Business day in Asia/Kolkata · All warehouse
              and vehicle operations
            </p>
          </div>
          <div className="flex-row flex-wrap no-print">
            <Field
              label="Report date"
              type="date"
              value={selectedDay}
              max={day()}
              onChange={(e: any) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
            <Btn
              light
              aria-label="Refresh daily report"
              onClick={() => setRetry((r) => r + 1)}
              disabled={loading}
            >
              <RefreshCw size={16} />
            </Btn>
          </div>
        </div>
        <p className="form-help">
          {selectedDay === day()
            ? "Today’s figures show confirmed activity so far. They update as your team saves transactions."
            : "Opening and closing quantities are calculated from recorded stock movements for this date."}{" "}
          Product labels use the current catalogue.
        </p>
        {error && (
          <div className="alert error mt-4" role="alert">
            {error}
            <button
              className="text-link"
              onClick={() => setRetry((r) => r + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {loading && (
          <p className="muted mt-4" role="status">
            Loading daily report…
          </p>
        )}
      </section>
      {summary && (
        <>
          <div className="stats">
            <Kpi
              title="Sales"
              value={money(summary.totals.sales)}
              foot={`${summary.totals.orders} confirmed orders`}
              icon={Coins}
            />
            <Kpi
              title="Collections"
              value={money(summary.totals.collections)}
              foot="Payments received on this day"
              icon={Wallet}
              tone="teal"
            />
            <Kpi
              title="Warehouse closing"
              value={num(summary.totals.warehouse)}
              foot="Base units remaining"
              icon={Warehouse}
            />
            <Kpi
              title="Vehicle closing"
              value={num(summary.totals.vehicles)}
              foot="Base units across vehicles"
              icon={Truck}
            />
          </div>
          <section className="clay panel">
            <div className="panel-head">
              <div className="view-switch no-print">
                {[
                  ["stock", "Stock report"],
                  ["sales", "Sales report"],
                  ["workers", "Team activity"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={tab === id ? "active" : ""}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-row no-print">
                <Btn light disabled={!summary[tab].length} onClick={download}>
                  <Download size={15} />
                  CSV
                </Btn>
                <Btn light onClick={() => window.print()}>
                  <Printer size={15} />
                  Print / PDF
                </Btn>
              </div>
            </div>
            <h3 className="print-only">
              {tab === "stock"
                ? "Stock report"
                : tab === "sales"
                  ? "Sales report"
                  : "Team activity"}
            </h3>
            <ReportTables summary={summary} tab={tab} />
          </section>
          {!owner && (
            <section className="clay panel no-print">
              <div className="panel-head">
                <div>
                  <h2>
                    {own
                      ? "Update your submitted report"
                      : "Send your daily report to admin"}
                  </h2>
                  <p>
                    The server saves a snapshot of the entire business day and
                    each person’s recorded activity.
                  </p>
                </div>
                <Btn
                  disabled={busy || pendingCount > 0 || loading}
                  onClick={() => setConfirm(true)}
                >
                  <Send size={16} />
                  {own ? "Resubmit report" : "Submit daily report"}
                </Btn>
              </div>
              {pendingCount > 0 && (
                <p className="alert error">
                  Sync the {pendingCount} pending transactions on this device
                  before submitting.
                </p>
              )}
              <p className="form-help">
                Later transactions appear in the live report. Submit again to
                update the saved snapshot.
              </p>
            </section>
          )}
          <section className="clay panel no-print">
            <div className="panel-head">
              <div>
                <h2>
                  {owner ? "Reports received from workers" : "Your submissions"}
                </h2>
                <p>
                  Saved snapshots for {date(selectedDay)}. Each resubmission
                  needs a new admin review.
                </p>
              </div>
            </div>
            <DataTable
              rows={data?.submissions || []}
              columns={[
                { key: "submitted_by_name", label: "Worker" },
                {
                  key: "submitted_at",
                  label: "Submitted",
                  render: (r) =>
                    `${date(r.submitted_at)} · ${time(r.submitted_at)}`,
                },
                { key: "revision", label: "Version" },
                {
                  key: "reviewed_at",
                  label: "Status",
                  render: (r) => (
                    <Badge>{r.reviewed_at ? "Reviewed" : "Pending"}</Badge>
                  ),
                },
                {
                  key: "open",
                  label: "Report",
                  render: (r) => (
                    <button className="text-link" onClick={() => setView(r)}>
                      View snapshot
                    </button>
                  ),
                },
              ]}
              empty="No reports submitted for this day"
            />
          </section>
        </>
      )}
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title="Submit the daily report"
        description={`Send confirmed sales and stock for ${date(selectedDay)} to your admin.`}
      >
        <div className="stack">
          <p className="muted">
            This captures all business activity currently saved for that date,
            including a breakdown by the person who recorded it.
          </p>
          <Field
            label="Notes for admin"
            value={notes}
            maxLength={500}
            onChange={(e: any) => setNotes(e.target.value)}
          />
          <Btn
            busy={busy}
            disabled={pendingCount > 0}
            onClick={() =>
              run("submit_daily_report", { day: selectedDay, notes })
            }
          >
            <Send size={15} />
            Confirm & submit
          </Btn>
        </div>
      </Modal>
      {view && (
        <Modal
          open
          wide
          onClose={() => {
            if (!busy) setView(null);
          }}
          title={`${view.submitted_by_name} · ${date(view.report_day)}`}
          description={`Version ${view.revision} · Saved ${date(view.submitted_at)} at ${time(view.submitted_at)}`}
        >
          <div className="stack">
            <p className="muted">
              This is the saved snapshot of the business day. Live figures may
              have changed since submission.
            </p>
            <div className="daily-metrics">
              <div>
                <span>Sales</span>
                <strong>{money(view.summary.totals.sales)}</strong>
              </div>
              <div>
                <span>Warehouse closing</span>
                <strong>{num(view.summary.totals.warehouse)}</strong>
              </div>
              <div>
                <span>Vehicle closing</span>
                <strong>{num(view.summary.totals.vehicles)}</strong>
              </div>
            </div>
            {view.notes && <p className="report-notes">{view.notes}</p>}
            <h3>Stock report</h3>
            <ReportTables summary={view.summary} tab="stock" />
            <h3>Sales report</h3>
            <ReportTables summary={view.summary} tab="sales" />
            <h3>Recorded team activity</h3>
            <ReportTables summary={view.summary} tab="workers" />
            {view.reviewed_at ? (
              <p className="flex-row">
                <Check size={16} />
                Reviewed by {view.reviewed_by_name} at {time(view.reviewed_at)}
              </p>
            ) : (
              owner && (
                <Btn
                  busy={busy}
                  onClick={() =>
                    run("review_daily_report", {
                      id: view.id,
                      revision: view.revision,
                    })
                  }
                >
                  <Check size={16} />
                  Mark reviewed
                </Btn>
              )
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
