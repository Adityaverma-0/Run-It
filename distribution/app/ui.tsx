"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Box, Plus, LoaderCircle } from "lucide-react";
import type { Row } from "@/lib/client";
export function Btn({ children, light = false, busy = false, ...props }: any) {
  return (
    <Button
      className={`btn ${light ? "btn-light" : "btn-primary"}`}
      {...props}
      disabled={busy || props.disabled}
    >
      {busy && <LoaderCircle size={15} className="animate-spin" />}
      {children}
    </Button>
  );
}
export function Empty({
  icon: Icon = Box,
  title,
  description,
  action,
  label,
}: any) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Btn light onClick={action}>
          <Plus size={14} />
          {label}
        </Btn>
      )}
    </div>
  );
}
export function Kpi({ title, value, foot, icon: Icon, tone = "" }: any) {
  return (
    <div className="clay kpi">
      <div className="spread">
        <span className="label">{title}</span>
        <span className={`kpi-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="number">{value}</div>
      <div className="foot">{foot}</div>
    </div>
  );
}
export function Badge({ children }: any) {
  const v = String(children);
  return (
    <span
      className={`badge ${["ON ROUTE", "Active", "Paid", "Synced", "RECEIPT", "HOLD"].includes(v) ? "green" : ["LOADED", "RETURNED", "RECONCILIATION", "Pending", "Low stock", "CREDIT"].includes(v) ? "amber" : ["MAINTENANCE", "Failed", "Inactive", "DAMAGE", "LOSS", "Overdue"].includes(v) ? "red" : ""}`}
    >
      {v === "ON ROUTE" ? "Dispatched" : children}
    </span>
  );
}
export function Field({ label, id, children, ...props }: any) {
  const name = id || label.replaceAll(" ", "-").toLowerCase();
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children || <Input id={name} className="input" {...props} />}
    </div>
  );
}
export function Pick({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  ...props
}: any) {
  return (
    <Select
      value={value || "__none"}
      onValueChange={(v) => onChange(v === "__none" ? "" : v)}
    >
      <SelectTrigger
        className="input"
        aria-label={label}
        id={label?.replaceAll(" ", "-").toLowerCase()}
        {...props}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">{placeholder}</SelectItem>
        {options.map((x: any) => (
          <SelectItem
            key={typeof x === "string" ? x : x.value}
            value={typeof x === "string" ? x : x.value}
          >
            {typeof x === "string" ? x : x.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function DataTable({
  columns,
  rows,
  empty = "No records yet",
  onRow,
}: {
  columns: { key: string; label: string; render?: (r: Row) => any }[];
  rows: Row[];
  empty?: string;
  onRow?: (r: Row) => void;
}) {
  return rows.length ? (
    <Table className="data-table">
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.key}>{c.label}</TableHead>
          ))}
          {onRow && (
            <TableHead>
              <span className="sr-only">Open record</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={r.id || i}>
            {columns.map((c) => (
              <TableCell key={c.key}>
                {c.render ? c.render(r) : r[c.key]}
              </TableCell>
            ))}
            {onRow && (
              <TableCell>
                <button className="text-link" onClick={() => onRow(r)}>
                  View
                </button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <Empty
      title={empty}
      description="Records will appear here when they are added."
    />
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  wide,
  children,
}: any) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className={wide ? "dialog-wide" : "dialog-standard"}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
export function StockFlow({ summary }: any) {
  return (
    <div className="flow-summary">
      {[
        ["Opening", summary.opening],
        ["+", null],
        ["New load", summary.loaded],
        ["−", null],
        ["Sold", summary.sold],
        ["=", null],
        ["Remaining", summary.remaining],
      ].map(([label, n], i) =>
        n === null ? (
          <span key={i} className="muted">
            {label}
          </span>
        ) : (
          <div key={i} className={`flow-number ${i === 6 ? "result" : ""}`}>
            <span>{label}</span>
            <b>{n}</b>
          </div>
        ),
      )}
    </div>
  );
}
