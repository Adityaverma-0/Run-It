"use client";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Check,
  Truck,
  Package,
  ShieldCheck,
  ClipboardCheck,
  Minus,
  AlertCircle,
  Warehouse,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Btn, Field, Pick, Modal, Empty, StockFlow, Badge } from "./ui";
import {
  money,
  num,
  stockSummary,
  can,
  roleNames,
  type State,
  type Row,
  day,
} from "@/lib/client";
type Props = {
  s: State;
  kind: string;
  initial?: Row;
  close: () => void;
  save: (action: string, data: Row) => Promise<any>;
};
const defaults: Record<string, Row> = {
  product: {
    name: "",
    sku: "",
    brand: "",
    category: "",
    unit: "Packet",
    box_size: 1,
    carton_size: 1,
    price: 0,
    cost: 0,
    tax_rate: 0,
    min_stock: 0,
    active: true,
  },
  customer: {
    name: "",
    owner_name: "",
    phone: "",
    address: "",
    route_id: "",
    credit_limit: 0,
  },
  vehicle: { number: "", type: "Delivery van", salesman_id: "", route_id: "" },
  route: { name: "", area: "", notes: "" },
  user: { name: "", email: "", role: "salesman", active: true },
  inventory: { product_id: "", qty: "", kind: "RECEIPT", notes: "" },
  payment: { customer_id: "", amount: "", method: "CASH", reference: "" },
  settings: {
    business_name: "Sanket Distribution",
    warehouse_name: "Central warehouse",
    phone: "",
    address: "",
    gstin: "",
  },
};
export default function RecordForm({ s, kind, initial, close, save }: Props) {
  const [f, setF] = useState<Row>({ ...defaults[kind], ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: any) =>
    setF((v) => ({ ...v, [key]: value }));
  const input = (
    key: string,
    label: string,
    type = "text",
    extra: Row = {},
  ) => (
    <Field
      key={key}
      label={label}
      type={type}
      value={f[key] ?? ""}
      onChange={(e: any) => set(key, e.target.value)}
      {...extra}
    />
  );
  const pick = (
    key: string,
    label: string,
    options: any[],
    placeholder?: string,
  ) => (
    <Field key={key} label={label}>
      <Pick
        label={label}
        value={f[key]}
        onChange={(v: string) => set(key, v)}
        options={options}
        placeholder={placeholder}
      />
    </Field>
  );
  const options = (key: keyof State, label = "name") =>
    (s[key] as Row[]).map((x) => ({ value: x.id, label: x[label] }));
  const customer = s.customers.find((c) => c.id === f.customer_id);
  const product = s.products.find((c) => c.id === f.product_id);
  async function submit(e: any) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await save(kind, f);
      close();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const titles: Record<string, string> = {
    product: "product",
    customer: "customer",
    vehicle: "vehicle",
    route: "route",
    user: "team member",
    inventory: "stock movement",
    payment: "payment",
    settings: "business settings",
  };
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) close();
      }}
      title={`${kind === "settings" ? "Update" : initial?.id ? "Edit" : kind === "payment" ? "Collect" : kind === "inventory" ? "Record" : "Add"} ${titles[kind]}`}
      description={
        kind === "payment"
          ? "Record a collection against the customer’s outstanding balance."
          : kind === "inventory"
            ? "All quantities are recorded in the product’s base unit."
            : "Save information to your distribution workspace."
      }
    >
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          {kind === "product" && (
            <>
              {input("name", "Product name", "text", {
                required: true,
                maxLength: 120,
              })}
              {input("sku", "SKU", "text", { required: true, maxLength: 50 })}
              {input("brand", "Brand")}
              {input("category", "Category")}
              {pick("unit", "Base unit", [
                "Packet",
                "Piece",
                "Bottle",
                "Bag",
                "Box",
                "Carton",
              ])}
              {input("price", "Selling price per base unit (₹)", "number", {
                min: 0,
                step: ".01",
                required: true,
              })}
              {input("cost", "Cost per base unit (₹)", "number", {
                min: 0,
                step: ".01",
              })}
              {input("tax_rate", "Tax rate (%)", "number", {
                min: 0,
                max: 100,
                step: ".01",
              })}
              {input("box_size", "Base units per box", "number", {
                min: 1,
                step: 1,
                required: true,
              })}
              {input("carton_size", "Base units per carton", "number", {
                min: 1,
                step: 1,
                required: true,
              })}
              {input("min_stock", "Minimum warehouse stock", "number", {
                min: 0,
                step: 1,
                required: true,
              })}
              <label className="flex-row">
                <Checkbox
                  checked={f.active}
                  onCheckedChange={(v) => set("active", v === true)}
                />
                Active product
              </label>
              <p className="form-help full">
                Starting stock is recorded separately in Inventory → Receive
                stock.
              </p>
            </>
          )}
          {kind === "customer" && (
            <>
              {input("name", "Shop name", "text", { required: true })}
              {input("owner_name", "Owner name")}
              {input("phone", "Phone number", "tel", {
                pattern: "[+0-9 ()-]{7,20}",
              })}
              {pick("route_id", "Route", options("routes"), "Unassigned")}
              {input("address", "Address")}
              {input("credit_limit", "Credit limit (₹)", "number", {
                min: 0,
                step: ".01",
                required: true,
              })}
              <p className="form-help full">
                A zero credit limit requires full payment when a sale is made.
              </p>
            </>
          )}
          {kind === "vehicle" && (
            <>
              {input("number", "Vehicle number", "text", { required: true })}
              {pick("type", "Vehicle type", [
                "Delivery van",
                "Mini truck",
                "Truck",
                "Three-wheeler",
                "Two-wheeler",
              ])}
              {pick(
                "salesman_id",
                "Assigned salesman",
                s.users
                  .filter((u) => u.role === "salesman" && u.active)
                  .map((u) => ({ value: u.id, label: u.name })),
                "Unassigned",
              )}
              {pick(
                "route_id",
                "Assigned route",
                options("routes"),
                "Unassigned",
              )}
              <p className="form-help full">
                Add team members in Settings before assigning a salesman.
              </p>
            </>
          )}
          {kind === "route" && (
            <>
              {input("name", "Route name", "text", { required: true })}
              {input("area", "Area")}
              <div className="full">{input("notes", "Route notes")}</div>
            </>
          )}
          {kind === "user" && (
            <>
              {input("name", "Full name", "text", { required: true })}
              {input("email", "Sign-in email", "email", { required: true })}
              {pick(
                "role",
                "Role",
                Object.entries(roleNames)
                  .filter(([k]) => k !== "owner")
                  .map(([value, label]) => ({ value, label })),
              )}
              <label className="flex-row">
                <Checkbox
                  checked={f.active}
                  onCheckedChange={(v) => set("active", v === true)}
                />
                Account active
              </label>
              <p className="form-help full">
                After saving, create an access link in Team & access so this
                person can choose a password. Changing their email removes the
                old login; create a fresh access link for their new email. No
                email is sent automatically.
              </p>
            </>
          )}
          {kind === "inventory" && (
            <>
              {pick("product_id", "Product", options("products"))}
              {pick("kind", "Movement", ["RECEIPT", "DAMAGE"])}
              {input("qty", "Quantity in base units", "number", {
                min: 1,
                step: 1,
                required: true,
              })}
              {input(
                "notes",
                f.kind === "DAMAGE" ? "Damage reason" : "Supplier / reference",
                "text",
                { required: f.kind === "DAMAGE" },
              )}
              {product && (
                <p className="form-help full">
                  Warehouse: {num(product.warehouse_qty)}{" "}
                  {product.unit.toLowerCase()}s · 1 box = {product.box_size}{" "}
                  base units.
                </p>
              )}
            </>
          )}
          {kind === "payment" && (
            <>
              {pick("customer_id", "Customer", options("customers"))}
              {input("amount", "Amount received (₹)", "number", {
                min: ".01",
                max: customer?.balance,
                step: ".01",
                required: true,
              })}
              {pick("method", "Payment method", [
                "CASH",
                "UPI",
                "BANK TRANSFER",
              ])}
              {input("reference", "Reference number")}
              {customer && (
                <div className="alert full">
                  Outstanding balance: <b>{money(customer.balance)}</b>
                </div>
              )}
            </>
          )}
          {kind === "settings" && (
            <>
              {input("business_name", "Business name", "text", {
                required: true,
              })}
              {input("warehouse_name", "Warehouse name", "text", {
                required: true,
              })}
              {input("phone", "Business phone", "tel")}
              {input("gstin", "GSTIN")}
              {input("address", "Business address")}
              <p className="form-help full">
                Currency: INR (₹) · Business timezone: Asia/Kolkata
              </p>
            </>
          )}
        </div>
        {error && (
          <div className="alert error" role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        <div className="form-actions">
          <Btn type="button" light onClick={close} disabled={busy}>
            Cancel
          </Btn>
          <Btn type="submit" busy={busy}>
            <Check size={15} />
            {kind === "payment"
              ? "Record payment"
              : kind === "inventory"
                ? "Record movement"
                : "Save changes"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
export function TransactionForm({ s, kind, initial, close, save }: Props) {
  const loading = kind === "load";
  const [step, setStep] = useState(0);
  const [vehicleId, setVehicle] = useState(
    initial?.vehicle_id ||
      s.vehicles.find((v) =>
        loading
          ? ["AVAILABLE", "LOADED", "CLOSED"].includes(v.status)
          : v.status === "ON ROUTE",
      )?.id ||
      "",
  );
  const [customerId, setCustomer] = useState(initial?.customer_id || "");
  const [items, setItems] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("CASH");
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const v = s.vehicles.find((v) => v.id === vehicleId);
  const c = s.customers.find((c) => c.id === customerId);
  const subtotal = items.reduce(
    (n, i) =>
      n +
      i.qty * Number(s.products.find((p) => p.id === i.product_id)?.price || 0),
    0,
  );
  const tax = items.reduce((n, i) => {
    const p = s.products.find((p) => p.id === i.product_id);
    return (
      n +
      Math.round(
        i.qty *
          Number(p?.price || 0) *
          (subtotal ? (subtotal - discount) / subtotal : 0) *
          Number(p?.tax_rate || 0),
      ) /
        100
    );
  }, 0);
  const total = Math.round((subtotal - discount + tax) * 100) / 100;
  const paidValue =
    method === "CREDIT" ? 0 : paid === null ? total : Number(paid);
  const available = (id: string) =>
    loading
      ? Number(s.products.find((p) => p.id === id)?.warehouse_qty || 0)
      : Number(
          s.stock.find((x) => x.vehicle_id === vehicleId && x.product_id === id)
            ?.qty || 0,
        );
  const invalid = items.some(
    (i) =>
      i.qty < 1 || !Number.isInteger(i.qty) || i.qty > available(i.product_id),
  );
  const availableProducts = s.products.filter(
    (p) => p.active && available(p.id) > 0,
  );
  const steps = loading
    ? ["Vehicle & opening", "Add products", "Review & confirm"]
    : ["Customer & vehicle", "Add products", "Payment & confirm"];
  const update = (id: string, qty: number) =>
    setItems((rows) =>
      rows.map((i) => (i.product_id === id ? { ...i, qty } : i)),
    );
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await save(loading ? "load" : "sale", {
        vehicle_id: vehicleId,
        customer_id: customerId,
        items,
        discount,
        paid: paidValue,
        method,
        reference,
      });
      close();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      wide
      onClose={() => {
        if (!busy) close();
      }}
      title={loading ? "Morning vehicle load" : "New customer sale"}
      description={
        loading
          ? "Move warehouse stock into a vehicle, with opening stock carried forward."
          : "Choose a shop, add products and record the payment."
      }
    >
      <div className="stepper">
        {steps.map((label, i) => (
          <div
            className={i === step ? "current" : i < step ? "done" : ""}
            key={label}
          >
            <span>{i < step ? <Check size={12} /> : i + 1}</span>
            {label}
          </div>
        ))}
      </div>
      {step === 0 && (
        <div className="stack">
          <div className="form-grid">
            {!loading && (
              <Field label="Customer">
                <Pick
                  label="Customer"
                  value={customerId}
                  onChange={setCustomer}
                  options={s.customers.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </Field>
            )}
            <Field label="Vehicle">
              <Pick
                label="Vehicle"
                value={vehicleId}
                onChange={(v: string) => {
                  setVehicle(v);
                  setItems([]);
                }}
                options={s.vehicles
                  .filter((v) =>
                    loading
                      ? ["AVAILABLE", "LOADED", "CLOSED"].includes(v.status)
                      : v.status === "ON ROUTE",
                  )
                  .map((v) => ({
                    value: v.id,
                    label: `${v.number} · ${v.status}`,
                  }))}
              />
            </Field>
          </div>
          {v && (
            <section className="clay panel">
              <div className="spread">
                <h3>{v.number}</h3>
                <Badge>{v.status}</Badge>
              </div>
              <p className="muted small">
                {v.salesman_name || "No salesman assigned"} ·{" "}
                {v.route_name || "No route assigned"}
              </p>
              {loading ? (
                <div className="flow-summary">
                  <div className="flow-number">
                    <span>Held / opening stock</span>
                    <b>{num(v.stock_qty)}</b>
                  </div>
                  <Plus size={18} />
                  <div className="flow-number">
                    <span>New load</span>
                    <b>{num(items.reduce((n, i) => n + i.qty, 0))}</b>
                  </div>
                  <span>=</span>
                  <div className="flow-number result">
                    <span>Available after load</span>
                    <b>
                      {num(v.stock_qty + items.reduce((n, i) => n + i.qty, 0))}
                    </b>
                  </div>
                </div>
              ) : (
                <StockFlow summary={stockSummary(s, v.id)} />
              )}
            </section>
          )}
          {c && !loading && (
            <div className="alert">
              Outstanding {money(c.balance)} · Credit limit{" "}
              {money(c.credit_limit)}
            </div>
          )}
          {(!s.vehicles.length || (!loading && !s.customers.length)) && (
            <Empty
              icon={loading ? Truck : Warehouse}
              title={
                loading
                  ? "Add a vehicle to start loading"
                  : "Prepare your first sale"
              }
              description={
                loading
                  ? "Add a vehicle and assign a salesman in Vehicles."
                  : "Add a customer, load a vehicle and dispatch it to its route first."
              }
            />
          )}
        </div>
      )}
      {step === 1 && (
        <div className="stack">
          <Field
            label="Find a product"
            value={query}
            onChange={(e: any) => setQuery(e.target.value)}
            placeholder="Search name or SKU"
          />
          <div className="product-picker">
            {availableProducts
              .filter((p) =>
                (p.name + " " + p.sku)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((p) => {
                const line = items.find((i) => i.product_id === p.id);
                return (
                  <div className="product-pick" key={p.id}>
                    <div>
                      <h3>{p.name}</h3>
                      <p className="small muted">
                        {available(p.id)} {p.unit.toLowerCase()}s available ·{" "}
                        {money(p.price)} each
                      </p>
                    </div>
                    {line ? (
                      <div className="qty">
                        <button
                          aria-label={`Decrease ${p.name}`}
                          onClick={() =>
                            line.qty <= 1
                              ? setItems(
                                  items.filter((i) => i.product_id !== p.id),
                                )
                              : update(p.id, line.qty - 1)
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          aria-label={`${p.name} quantity`}
                          className="input"
                          type="number"
                          min="1"
                          max={available(p.id)}
                          value={line.qty}
                          onChange={(e) => update(p.id, Number(e.target.value))}
                        />
                        <button
                          aria-label={`Increase ${p.name}`}
                          disabled={line.qty >= available(p.id)}
                          onClick={() => update(p.id, line.qty + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <Btn
                        light
                        onClick={() =>
                          setItems([...items, { product_id: p.id, qty: 1 }])
                        }
                      >
                        <Plus size={14} />
                        Add
                      </Btn>
                    )}
                  </div>
                );
              })}
            {!availableProducts.length && (
              <Empty
                icon={Package}
                title={
                  loading
                    ? "No warehouse stock available"
                    : "No vehicle stock available"
                }
                description={
                  loading
                    ? "Receive stock in Inventory before creating a load."
                    : "Load products into this vehicle before making a sale."
                }
              />
            )}
          </div>
          <p className="form-help">
            Enter base units. Packaging conversions are shown in product
            details.
          </p>
          {invalid && (
            <div className="alert error">
              Insufficient {loading ? "warehouse" : "vehicle"} stock. Correct
              the highlighted quantities before continuing.
            </div>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="stack">
          <div className="alert">
            <Truck size={17} />
            {v?.number} · {loading ? v?.salesman_name : c?.name}
          </div>
          <div>
            {items.map((i) => {
              const p = s.products.find((p) => p.id === i.product_id)!;
              return (
                <div className="review-line" key={i.product_id}>
                  <span>
                    {p.name}
                    <small>
                      {num(i.qty)} {p.unit.toLowerCase()}s
                    </small>
                  </span>
                  <b>{loading ? num(i.qty) : money(i.qty * p.price)}</b>
                </div>
              );
            })}
          </div>
          {!loading && (
            <>
              <div className="form-grid">
                <Field label="Payment method">
                  <Pick
                    label="Payment method"
                    value={method}
                    onChange={(m: string) => {
                      setMethod(m);
                      setPaid(null);
                    }}
                    options={["CASH", "UPI", "CREDIT", "BANK TRANSFER"]}
                  />
                </Field>
                <Field
                  label="Discount (₹)"
                  type="number"
                  min="0"
                  max={subtotal}
                  step=".01"
                  value={discount}
                  onChange={(e: any) => setDiscount(Number(e.target.value))}
                />
                <Field
                  label="Paid amount (₹)"
                  type="number"
                  min="0"
                  max={total}
                  step=".01"
                  disabled={method === "CREDIT"}
                  value={paidValue}
                  onChange={(e: any) => setPaid(e.target.value)}
                />
                <Field
                  label="Payment reference"
                  value={reference}
                  onChange={(e: any) => setReference(e.target.value)}
                />
              </div>
              <div className="total-box">
                <div className="spread">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="spread">
                  <span>Discount</span>
                  <span>−{money(discount)}</span>
                </div>
                <div className="spread">
                  <span>Tax after discount</span>
                  <span>{money(tax)}</span>
                </div>
                <div className="spread grand">
                  <span>Grand total</span>
                  <span>{money(total)}</span>
                </div>
                <div className="spread">
                  <span>Outstanding on this sale</span>
                  <span>{money(total - paidValue)}</span>
                </div>
              </div>
              {Number(c?.balance) + total - paidValue >
                Number(c?.credit_limit) && (
                <div className="alert error">
                  This sale exceeds the customer's credit limit.
                </div>
              )}
            </>
          )}
          {loading && (
            <div className="total-box">
              <div className="spread">
                <span>Opening / held stock</span>
                <b>{num(v?.stock_qty)}</b>
              </div>
              <div className="spread">
                <span>New load</span>
                <b>{num(items.reduce((n, i) => n + i.qty, 0))}</b>
              </div>
              <div className="spread grand">
                <span>Available vehicle stock</span>
                <b>
                  {num(
                    Number(v?.stock_qty) + items.reduce((n, i) => n + i.qty, 0),
                  )}
                </b>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <Btn
          light
          onClick={() => (step ? setStep(step - 1) : close())}
          disabled={busy}
        >
          {step ? "Back" : "Cancel"}
        </Btn>
        {step < 2 ? (
          <Btn
            onClick={() => setStep(step + 1)}
            disabled={
              step === 0
                ? !vehicleId ||
                  (!loading && !customerId) ||
                  (loading && !v?.salesman_id)
                : !items.length || invalid
            }
          >
            Continue
          </Btn>
        ) : (
          <Btn
            busy={busy}
            disabled={
              invalid ||
              !items.length ||
              (!loading &&
                (discount < 0 ||
                  discount > subtotal ||
                  paidValue < 0 ||
                  paidValue > total ||
                  Number(c?.balance) + total - paidValue >
                    Number(c?.credit_limit)))
            }
            onClick={submit}
          >
            <Check size={15} />
            {loading ? "Confirm load" : "Confirm sale"}
          </Btn>
        )}
      </div>
    </Modal>
  );
}
export function ReconcileForm({ s, initial, close, save }: Props) {
  const [vehicleId, setVehicle] = useState(initial?.vehicle_id || "");
  const [counts, setCounts] = useState<Row>({});
  const [decision, setDecision] = useState("HOLD");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const v = s.vehicles.find((v) => v.id === vehicleId);
  const stock = s.stock.filter((x) => x.vehicle_id === vehicleId && x.qty > 0);
  const total = stock.reduce(
    (n, x) => n + Number(counts[x.product_id] || 0),
    0,
  );
  const valid = stock.every(
    (x) =>
      counts[x.product_id] !== undefined &&
      counts[x.product_id] !== "" &&
      Number.isInteger(Number(counts[x.product_id])) &&
      Number(counts[x.product_id]) >= 0 &&
      Number(counts[x.product_id]) <= x.qty,
  );
  const variance = stock.some((x) => Number(counts[x.product_id]) !== x.qty);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await save("reconcile", {
        vehicle_id: vehicleId,
        items: stock.map((x) => ({
          product_id: x.product_id,
          physical: Number(counts[x.product_id]),
        })),
        decision,
        notes: note,
      });
      close();
    } catch (e: any) {
      setError(e.message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Modal
        open
        wide
        title="End-of-day reconciliation"
        description="Count every remaining product, then decide where the stock stays."
        onClose={() => {
          if (!busy) close();
        }}
      >
        <div className="stack">
          <Field label="Vehicle">
            <Pick
              label="Vehicle"
              value={vehicleId}
              onChange={(v: string) => {
                setVehicle(v);
                setCounts({});
              }}
              options={s.vehicles
                .filter((v) =>
                  ["LOADED", "ON ROUTE", "RETURNED", "RECONCILIATION"].includes(
                    v.status,
                  ),
                )
                .map((v) => ({ value: v.id, label: v.number }))}
            />
          </Field>
          {v && (
            <>
              <StockFlow summary={stockSummary(s, v.id)} />
              <h3>Physical stock count</h3>
              <div>
                {stock.map((x) => {
                  const p = s.products.find((p) => p.id === x.product_id);
                  return (
                    <div className="review-line" key={x.product_id}>
                      <span>
                        {p?.name}
                        <small>
                          Expected: {x.qty} {p?.unit.toLowerCase()}s
                        </small>
                      </span>
                      <input
                        className="input"
                        style={{ width: 100 }}
                        aria-label={`Physical count ${p?.name}`}
                        type="number"
                        min="0"
                        max={x.qty}
                        step="1"
                        placeholder="Count"
                        value={counts[x.product_id] ?? ""}
                        onChange={(e) =>
                          setCounts({
                            ...counts,
                            [x.product_id]: e.target.value,
                          })
                        }
                      />
                    </div>
                  );
                })}
                {!stock.length && (
                  <div className="alert">
                    There is no remaining stock. Close this vehicle day to
                    complete reconciliation.
                  </div>
                )}
              </div>
              <Field
                label="Reconciliation notes"
                value={note}
                onChange={(e: any) => setNote(e.target.value)}
                placeholder="Record any discrepancy or handover notes"
              />
              {variance && (
                <p className="form-help">
                  Any shortage requires an owner or warehouse manager and a
                  reason. Excess stock must be investigated before closing.
                </p>
              )}
              <h3>What should happen to remaining stock?</h3>
              <RadioGroup
                value={decision}
                onValueChange={setDecision}
                className="choice-grid"
              >
                <label
                  className="choice"
                  data-state={decision === "HOLD" ? "checked" : ""}
                >
                  <div className="flex-row">
                    <RadioGroupItem value="HOLD" />
                    <Truck size={21} />
                    <b>HOLD</b>
                  </div>
                  <p className="small muted mt-3">
                    Keep all remaining stock inside the vehicle. It becomes the
                    next day's opening stock.
                  </p>
                </label>
                <label
                  className="choice"
                  data-state={decision === "UNLOAD" ? "checked" : ""}
                >
                  <div className="flex-row">
                    <RadioGroupItem value="UNLOAD" />
                    <Warehouse size={21} />
                    <b>UNLOAD</b>
                  </div>
                  <p className="small muted mt-3">
                    Return all remaining stock to the warehouse. The vehicle
                    closes with zero stock.
                  </p>
                </label>
              </RadioGroup>
              <div className="total-box">
                <div className="spread">
                  <span>
                    {decision === "HOLD"
                      ? "Next day's opening stock"
                      : "Return to warehouse"}
                  </span>
                  <b>{num(total)} units</b>
                </div>
                <div className="spread">
                  <span>Vehicle closing stock</span>
                  <b>{num(decision === "HOLD" ? total : 0)} units</b>
                </div>
              </div>
            </>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Btn light onClick={close}>
              Cancel
            </Btn>
            <Btn
              disabled={
                !v ||
                !valid ||
                (variance &&
                  (!["owner", "warehouse_manager"].includes(s.user.role) ||
                    note.trim().length < 3))
              }
              onClick={() => setConfirm(true)}
            >
              Confirm {decision}
            </Btn>
          </div>
        </div>
      </Modal>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Close {v?.number} with {decision}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision === "HOLD"
                ? `Keep ${total} units in the vehicle for the next working day.`
                : `Return all ${total} remaining units to the warehouse.`}{" "}
              This closes the active vehicle day. The completed record cannot be
              edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              Back to counts
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {busy ? "Saving..." : `Confirm ${decision}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
