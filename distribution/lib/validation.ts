import { z } from "zod";
import { AppError } from "./auth";
const text = z.string().trim().max(500);
const name = text.min(1);
const uuid = z.string().uuid();
const optionalId = z.union([uuid, z.literal("")]).optional();
const integer = z.coerce.number().int().min(0).max(100000000);
const positive = integer.min(1);
const amount = z.coerce
  .number()
  .min(0)
  .max(9999999999.99)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001,
    "Use no more than two decimal places",
  );
const method = z.enum(["CASH", "UPI", "BANK TRANSFER"]);
const items = z
  .array(z.object({ product_id: uuid, qty: positive }))
  .min(1)
  .max(500);
const schemas: Record<string, z.ZodTypeAny> = {
  item_type: z.object({
    id: optionalId,
    name,
    kind: z.enum(["category", "unit"]),
  }),
  submit_daily_report: z.object({
    day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (value) =>
          Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value,
        "Choose a valid report date",
      ),
    notes: text.default(""),
  }),
  review_daily_report: z.object({ id: uuid, revision: positive }),
  product: z.object({
    id: optionalId,
    name,
    sku: name,
    brand: text.default(""),
    category: text.default(""),
    unit: name,
    box_size: positive,
    carton_size: positive,
    price: amount,
    cost: amount,
    tax_rate: amount.refine((n) => n <= 100),
    min_stock: integer,
    active: z.boolean().default(true),
  }),
  vehicle: z.object({
    id: optionalId,
    number: name.min(3),
    type: name,
    salesman_id: optionalId,
  }),
  user: z.object({
    id: optionalId,
    name,
    email: z.string().trim().email().max(254),
    role: z.enum([
      "worker",
      "warehouse_manager",
      "warehouse_staff",
      "sales_manager",
      "salesman",
      "accountant",
    ]),
    active: z.boolean().default(true),
  }),
  settings: z.object({
    business_name: name,
    warehouse_name: name,
    address: text.default(""),
    phone: text.default(""),
    gstin: text.default(""),
  }),
  inventory: z.object({
    product_id: uuid,
    qty: positive,
    kind: z.enum(["RECEIPT", "DAMAGE"]),
    notes: text.default(""),
  }),
  load: z.object({ vehicle_id: uuid, items }),
  start_day: z.object({ vehicle_id: uuid }),
  vehicle_status: z.object({
    vehicle_id: uuid,
    status: z.enum([
      "ON ROUTE",
      "RETURNED",
      "RECONCILIATION",
      "MAINTENANCE",
      "AVAILABLE",
    ]),
  }),
  sale: z
    .object({
      vehicle_id: uuid,
      customer_id: optionalId,
      buyer: z
        .object({ name, phone: text.default(""), address: text.default("") })
        .optional(),
      buyer_credit_limit: amount.optional(),
      buyer_salesman_id: uuid.optional(),
      items,
      discount: amount,
      paid: amount,
      method: z.enum(["CASH", "UPI", "BANK TRANSFER", "CREDIT"]),
      reference: text.default(""),
      notes: text.default(""),
    })
    .refine(
      (p) => Boolean(p.customer_id) !== Boolean(p.buyer),
      "Choose an existing buyer or enter a new buyer",
    ),
  payment: z.object({
    customer_id: uuid,
    amount: amount.refine((n) => n > 0),
    method,
    reference: text.default(""),
  }),
  reconcile: z.object({
    vehicle_id: uuid,
    decision: z.enum(["HOLD", "UNLOAD"]),
    items: z.array(z.object({ product_id: uuid, physical: integer })).max(500),
    notes: text.default(""),
  }),
  mark_read: z.object({ keys: z.array(z.string().max(150)).max(1000) }),
};
export function validate(action: string, data: unknown) {
  const schema = schemas[action];
  if (!schema) throw new AppError("Unknown action");
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new AppError(
      parsed.error.issues
        .map((i) => `${i.path.join(" ")}: ${i.message}`)
        .slice(0, 3)
        .join(". "),
    );
  return parsed.data;
}
