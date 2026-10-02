"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  ClipboardList,
  Wallet,
  ChartNoAxesCombined,
  ClipboardCheck,
  Bell,
  Settings,
  Search,
  ChevronRight,
  Plus,
  RefreshCw,
  LogOut,
  Cloud,
  AlertCircle,
  WifiOff,
  ShieldCheck,
  CalendarDays,
  Check,
  LoaderCircle,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Toaster, toast } from "sonner";
import { Btn, Empty, Modal, Badge } from "./ui";
import {
  Dashboard,
  Listing,
  Inventory,
  Detail,
  Notifications,
  SettingsPage,
} from "./pages";
import Reports from "./reports";
import { ItemTypes, DailyReports } from "./operations";
import { AccessScreen, PasswordDialog, authRequest } from "./access";
import RecordForm, { TransactionForm, ReconcileForm } from "./forms";
import {
  permissions,
  can,
  roleNames,
  notifications,
  day,
  date,
  time,
  type State,
  type Row,
} from "@/lib/client";
import {
  readLocal,
  writeLocal,
  removeLocal,
  clearLocal,
  sendAction,
  type Pending,
} from "@/lib/offline";
const links = [
  ["dashboard", "Overview", LayoutDashboard],
  ["sales", "Sales", ShoppingCart],
  ["products", "Products", Package],
  ["item-types", "Item types", Package],
  ["inventory", "Inventory", Warehouse],
  ["vehicles", "Vehicles", Truck],
  ["loads", "Loads", ClipboardList],
  ["payments", "Payments", Wallet],
  ["reports", "Reports", ChartNoAxesCombined],
  ["daily-reports", "Daily reports", ClipboardCheck],
  ["reconciliation", "Reconciliation", ClipboardCheck],
  ["notifications", "Notifications", Bell],
  ["sync", "Sync center", Cloud],
  ["settings", "Settings", Settings],
] as const;
const subtitles: Record<string, string> = {
  dashboard:
    "Here's your distribution overview. Every box, every sale, every day.",
  "item-types": "Your categories and packaging units, ready for every product.",
  "daily-reports": "Daily sales, stock and team updates in one place.",
  sales: "From the vehicle to the shop. Every order accounted for.",
  products: "A well-organised catalogue. Ready for every order.",
  inventory: "Know what is available, where it is, and where it went.",
  vehicles: "Keep your fleet and every unit on board in view.",
  loads: "Start the day with the right stock on the right vehicle.",
  payments: "Clear collections. Accurate customer balances.",
  reports: "Turn your daily operations into a clear business picture.",
  reconciliation:
    "Close the day with confidence. Count, confirm, carry forward.",
  notifications: "The updates that need your attention.",
  settings: "Make this workspace work for your business.",
  sync: "Keep track of transactions saved on this device.",
};
function NavMenu({ children }: any) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu onClick={() => setOpenMobile(false)}>{children}</SidebarMenu>
  );
}
export default function Workspace() {
  const [s, setS] = useState<State | null>(null);
  const stateRef = useRef<State | null>(null);
  const refreshVersion = useRef(0);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(0);
  const [online, setOnline] = useState(true);
  const [cached, setCached] = useState(false);
  const [form, setForm] = useState<{ kind: string; initial?: Row } | null>(
    null,
  );
  const [details, setDetails] = useState<{ kind: string; row: Row } | null>(
    null,
  );
  const [search, setSearch] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncLock = useRef(false);
  const [discard, setDiscard] = useState<Pending | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [lastSync, setLastSync] = useState("");
  const updateQueue = useCallback(async () => {
    const all = await readLocal("queue");
    setPending(
      (all || []).filter(
        (p: Pending) => p.userKey === stateRef.current?.user.key,
      ),
    );
  }, []);
  const refresh = useCallback(
    async (silent = false) => {
      const version = ++refreshVersion.current;
      if (!silent) setRefreshing(true);
      try {
        const r = await fetch("/api/state", {
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        });
        const data: any = await r.json();
        if (version !== refreshVersion.current) return null;
        if (!r.ok) {
          setAuth(r.status === 401 || r.status === 403 ? r.status : 0);
          if (r.status === 401 || r.status === 403) {
            setS(null);
            stateRef.current = null;
            throw new Error(data.error);
          }
          throw new Error(data.error || "Unable to load your workspace");
        }
        stateRef.current = data;
        setS(data);
        setAuth(0);
        setError("");
        setCached(false);
        setLastSync(data.serverTime);
        await writeLocal("cache", data, "state");
        await updateQueue();
        return data;
      } catch (e: any) {
        if (version !== refreshVersion.current) return null;
        if (!navigator.onLine) {
          const data = await readLocal("cache", "state");
          if (version !== refreshVersion.current) return null;
          if (data) {
            stateRef.current = data;
            setS(data);
            setCached(true);
            setAuth(0);
            setLastSync(data.serverTime);
            await updateQueue();
            return data;
          }
        }
        setError(e.message || "Cannot reach the database. Please retry.");
        return null;
      } finally {
        if (version === refreshVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [updateQueue],
  );
  const sync = useCallback(async () => {
    if (syncLock.current || !navigator.onLine || !stateRef.current) return;
    const run = async () => {
      syncLock.current = true;
      setSyncing(true);
      try {
        const items = ((await readLocal("queue")) || []).filter(
          (p: Pending) => p.userKey === stateRef.current?.user.key,
        );
        for (const item of items) {
          try {
            await sendAction(item);
            await removeLocal(item.requestId);
          } catch (e: any) {
            await writeLocal("queue", {
              ...item,
              status: "failed",
              error: e.message,
              rejected: e.status === 400,
            });
            if (e.status === 401 || e.status === 403 || !e.status) break;
          }
        }
        await refresh(true);
        await updateQueue();
      } finally {
        syncLock.current = false;
        setSyncing(false);
      }
    };
    if (navigator.locks) await navigator.locks.request("sanket-sync", run);
    else await run();
  }, [refresh, updateQueue]);
  useEffect(() => {
    setOnline(navigator.onLine);
    const start = async () => {
      const data = await refresh();
      if (data && navigator.onLine) {
        const queue = await readLocal("queue");
        if (queue?.some((p: Pending) => p.userKey === data.user.key))
          await sync();
      }
    };
    void start();
    const on = () => {
      setOnline(true);
      void sync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        void navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        void navigator.serviceWorker
          .getRegistrations()
          .then(async (registrations) => {
            for (const registration of registrations)
              if (registration.active?.scriptURL.endsWith("/sw.js"))
                await registration.unregister();
            for (const key of await caches.keys())
              if (key.startsWith("sanket-shell-")) await caches.delete(key);
          })
          .catch(() => {});
      }
    }
    const visibleRefresh = () => {
      if (navigator.onLine && document.visibilityState === "visible")
        void refresh(true);
    };
    const timer = setInterval(visibleRefresh, 20000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(timer);
      window.removeEventListener("focus", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
    };
  }, [refresh, sync]);
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (links.some((x) => x[0] === hash)) setPage(hash);
    const onHash = () => setPage(location.hash.slice(1) || "dashboard");
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", key);
    };
  }, []);
  const go = useCallback((p: string) => {
    setPage(p);
    location.hash = p;
    setDetails(null);
    setSearch(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "navigate_distribution_workspace",
            description:
              "Open an authorized distribution workspace screen. Does not create or change business records.",
            inputSchema: {
              type: "object",
              properties: {
                page: { type: "string", enum: links.map((l) => l[0]) },
              },
              required: ["page"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input: any) => {
              const role = stateRef.current?.user.role;
              const allowed = permissions[role || ""] || [];
              if (
                !links.some((l) => l[0] === input?.page) ||
                (!allowed.includes("*") && !allowed.includes(input.page))
              )
                throw new Error("Screen unavailable");
              go(input.page);
              return { page: input.page };
            },
          },
          { signal: life.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, [go]);
  const open = (kind: string, initial?: Row) => {
    setDetails(null);
    setForm({ kind, initial });
  };
  async function save(action: string, data: Row) {
    const body = { action, data, requestId: crypto.randomUUID() };
    const user = stateRef.current?.user;
    if (!user) throw new Error("Sign in before saving");
    if (!online && !["sale", "payment"].includes(action))
      throw new Error(
        "Reconnect to save this operation. Your entered values are kept open.",
      );
    if (["sale", "payment"].includes(action)) {
      const item: Pending = {
        ...body,
        userKey: user.key,
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      await writeLocal("queue", item);
      await updateQueue();
      if (!navigator.onLine) {
        toast.success("Saved locally. It will sync when you reconnect.");
        return { savedLocally: true };
      }
      try {
        const result = await sendAction(body);
        await removeLocal(body.requestId);
        toast.success(result.message);
        await refresh(true);
        return result;
      } catch (e: any) {
        if (e.status && e.status < 500) {
          await removeLocal(body.requestId);
          await updateQueue();
          throw e;
        }
        await writeLocal("queue", {
          ...item,
          status: "failed",
          error: e.message,
          rejected: e.status === 400,
        });
        await updateQueue();
        toast.warning("Saved locally. Open Sync center to check or retry.");
        return { savedLocally: true };
      }
    }
    const result = await sendAction(body);
    toast.success(result.message);
    await refresh(true);
    return result;
  }
  async function signOut() {
    try {
      await authRequest("logout");
      await clearLocal();
      if ("caches" in window) {
        for (const key of await caches.keys())
          if (key.startsWith("sanket-")) await caches.delete(key);
      }
      location.href = "/";
    } catch (e: any) {
      toast.error(e.message || "Unable to sign out. Please retry.");
    }
  }
  if (auth || (!s && !loading && !error))
    return <AccessScreen onSuccess={() => refresh()} />;
  const role = s?.user.role || "owner";
  const nav = links.filter(
    ([id]) =>
      permissions[role]?.includes("*") || permissions[role]?.includes(id),
  );
  const activePage = nav.some((l) => l[0] === page) ? page : "dashboard";
  const initials = (s?.user.name || "S")
    .split(" ")
    .map((x: string) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const pendingUnits: Record<string, number> = {};
  for (const p of pending)
    if (p.action === "sale")
      for (const i of p.data.items)
        pendingUnits[p.data.vehicle_id + ":" + i.product_id] =
          (pendingUnits[p.data.vehicle_id + ":" + i.product_id] || 0) + i.qty;
  const workingState = s
    ? {
        ...s,
        stock: s.stock.map((x) => ({
          ...x,
          qty: Math.max(
            0,
            x.qty - (pendingUnits[x.vehicle_id + ":" + x.product_id] || 0),
          ),
        })),
      }
    : null;
  const props = workingState
    ? {
        s: workingState,
        pendingCount: pending.length,
        go,
        open,
        detail: (kind: string, row: Row) => setDetails({ kind, row }),
        save,
      }
    : null;
  const unread = s ? notifications(s).filter((x) => !x.read).length : 0;
  const heading =
    activePage === "dashboard"
      ? `Good ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) < "12" ? "morning" : new Date().toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) < "17" ? "afternoon" : "evening"}${s?.user.name ? ", " + s.user.name.split(" ")[0] : ""}.`
      : links.find((l) => l[0] === activePage)?.[1];
  return (
    <SidebarProvider style={{ "--sidebar-width": "226px" } as any}>
      <Toaster position="top-right" richColors />
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-0">
          <a href="#dashboard" className="brand" aria-label="Sanket home">
            <span className="brand-mark">
              <Package size={24} />
            </span>
            <div className="group-data-[collapsible=icon]:hidden">
              <strong>
                sanket<span style={{ color: "#6b9da3" }}>.</span>
              </strong>
              <small>DISTRIBUTION</small>
            </div>
          </a>
        </SidebarHeader>
        <SidebarContent className="px-3">
          <div className="side-section group-data-[collapsible=icon]:hidden">
            WORKSPACE
          </div>
          <NavMenu>
            {nav.map(([id, label, Icon]) => (
              <SidebarMenuItem key={id}>
                {id === "reports" && (
                  <div className="side-section group-data-[collapsible=icon]:hidden">
                    MANAGE
                  </div>
                )}
                <SidebarMenuButton
                  className="nav-link"
                  isActive={activePage === id}
                  tooltip={label}
                  onClick={() => go(id)}
                >
                  <Icon />
                  <span>{label}</span>
                  {id === "notifications" && unread > 0 && (
                    <span className="ml-auto text-[10px]">{unread}</span>
                  )}
                  {id === "sync" && pending.length > 0 && (
                    <span className="ml-auto text-[10px]">
                      {pending.length}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </NavMenu>
        </SidebarContent>
        <SidebarFooter className="p-0">
          <button
            className="sidebar-status group-data-[collapsible=icon]:hidden text-left"
            onClick={() => go("sync")}
          >
            <span className="status-line">
              {online ? <Cloud size={14} /> : <WifiOff size={14} />}{" "}
              {syncing
                ? "Syncing records"
                : !online
                  ? "Working offline"
                  : pending.length
                    ? `${pending.length} pending sync`
                    : error
                      ? "Connection needs attention"
                      : "Workspace connected"}
            </span>
            <p>
              {lastSync
                ? `Last updated ${time(lastSync)}`
                : "Connecting to your workspace"}
            </p>
          </button>
          <div className="sidebar-foot flex-row">
            <span className="avatar" aria-label={s?.user.name || "Account"}>
              {initials}
            </span>
            <div className="group-data-[collapsible=icon]:hidden min-w-0">
              <b className="text-[12px] truncate block">
                {s?.user.name || "Your workspace"}
              </b>
              <div className="text-[10px] muted">{roleNames[role]}</div>
            </div>
            <button
              className="signout group-data-[collapsible=icon]:hidden"
              aria-label="Sign out"
              onClick={() => setLogoutConfirm(true)}
            >
              <LogOut size={15} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="flex-row">
            <SidebarTrigger />
            <span className="breadcrumb">
              Workspace <ChevronRight size={12} />
              <b>{links.find((l) => l[0] === activePage)?.[1]}</b>
            </span>
          </div>
          <div className="top-actions">
            <button
              className="search-trigger"
              onClick={() => setSearch(true)}
              aria-label="Search workspace"
            >
              <Search size={15} />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="branch-label muted small flex-row">
              <Warehouse size={15} />
              {s?.settings?.warehouse_name || "Central warehouse"}
            </span>
            <button
              className="icon-button relative"
              onClick={() => go("notifications")}
              aria-label={`Notifications, ${unread} unread`}
            >
              <Bell size={17} />
              {unread > 0 && (
                <span className="absolute top-2 right-2 bg-amber-600 w-1.5 h-1.5 rounded-full" />
              )}
            </button>
            <button
              className="avatar"
              onClick={() => setPasswordOpen(true)}
              aria-label="Account: change password"
              title="Change password"
            >
              {initials}
            </button>
          </div>
        </header>
        {(!online || cached) && (
          <div className="connection-banner">
            <WifiOff size={15} />
            You're offline. Sales and payments are saved on this device and sync
            when you reconnect.{" "}
            {pending.length > 0 && `${pending.length} pending.`}
          </div>
        )}
        <main className="workspace">
          <div className="page-heading">
            <div>
              <h1>{heading}</h1>
              <p>{subtitles[activePage]}</p>
            </div>
            <div className="heading-actions">
              <span className="flex-row muted small">
                <CalendarDays size={15} />
                {date(new Date())}
              </span>
              <button
                className="icon-button"
                title="Refresh workspace"
                aria-label="Refresh workspace"
                disabled={refreshing || !online}
                onClick={() => refresh()}
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>
              {activePage === "dashboard" && can(role, "sale") && (
                <Btn disabled={!s} onClick={() => open("sale")}>
                  <Plus size={15} />
                  New sale
                </Btn>
              )}
              {activePage === "dashboard" && role.startsWith("warehouse") && (
                <Btn disabled={!s} onClick={() => open("load")}>
                  <Plus size={15} />
                  Create load
                </Btn>
              )}
            </div>
          </div>
          {error && (
            <div className="alert error mb-5" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button onClick={() => refresh()} className="underline ml-auto">
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <div className="stack">
              <div className="loading-grid" aria-label="Loading workspace">
                {[1, 2, 3, 4].map((i) => (
                  <div className="skeleton" key={i} />
                ))}
              </div>
              <div className="skeleton h-80" />
            </div>
          ) : props ? (
            <>
              {activePage === "dashboard" ? (
                <Dashboard {...props} />
              ) : activePage === "inventory" ? (
                <Inventory {...props} />
              ) : activePage === "item-types" ? (
                <ItemTypes {...props} />
              ) : activePage === "daily-reports" ? (
                <DailyReports {...props} />
              ) : activePage === "reports" ? (
                <Reports {...props} />
              ) : activePage === "notifications" ? (
                <Notifications {...props} />
              ) : activePage === "settings" ? (
                <SettingsPage {...props} />
              ) : activePage === "sync" ? (
                <section className="clay panel">
                  <div className="panel-head">
                    <div>
                      <h2>Device sync center</h2>
                      <p>
                        {online ? "Online" : "Offline"} ·{" "}
                        {lastSync
                          ? `Last updated ${date(lastSync)} at ${time(lastSync)}`
                          : "No sync yet"}
                      </p>
                    </div>
                    <Btn
                      onClick={sync}
                      busy={syncing}
                      disabled={!online || !pending.length}
                    >
                      <RefreshCw size={14} />
                      Sync now
                    </Btn>
                  </div>
                  <div className="stack">
                    {pending.length ? (
                      pending.map((p) => (
                        <div className="sync-item" key={p.requestId}>
                          <div className="spread">
                            <h3>
                              {p.action === "sale"
                                ? "Customer sale"
                                : "Payment collection"}
                            </h3>
                            <Badge>
                              {p.status === "failed" ? "Failed" : "Pending"}
                            </Badge>
                          </div>
                          <p className="small muted">
                            Saved locally {date(p.createdAt)} at{" "}
                            {time(p.createdAt)}
                          </p>
                          <p className="small muted">
                            {s?.customers.find(
                              (c) => c.id === p.data.customer_id,
                            )?.name || p.data.buyer?.name}
                          </p>
                          {p.error && (
                            <p className="small text-red-700 mt-2">{p.error}</p>
                          )}
                          <p className="form-help mt-2">
                            Not confirmed in the database until sync succeeds.
                            Retrying cannot create a duplicate.
                          </p>
                          {p.rejected && (
                            <Btn light onClick={() => setDiscard(p)}>
                              Remove rejected transaction
                            </Btn>
                          )}
                        </div>
                      ))
                    ) : (
                      <Empty
                        icon={ShieldCheck}
                        title="Everything is synced"
                        description="No transactions are waiting on this device."
                      />
                    )}
                  </div>
                </section>
              ) : (
                <Listing key={activePage} page={activePage} {...props} />
              )}
            </>
          ) : null}
          <footer className="footer mt-6">
            <span>Sanket Distribution · Built for the everyday</span>
            <span className="connection">
              {s && online && !error && <i />}
              {s && online && !error ? "Live PostgreSQL data · " : ""}INR (₹) ·
              Asia/Kolkata
            </span>
          </footer>
        </main>
        <nav className="bottom-nav">
          {nav
            .filter((x) =>
              ["dashboard", "sales", "inventory", "loads"].includes(x[0]),
            )
            .slice(0, 4)
            .map(([id, label, Icon]) => (
              <button
                className={activePage === id ? "active" : ""}
                key={id}
                onClick={() => go(id)}
              >
                <Icon size={20} />
                {label}
              </button>
            ))}
          <button
            onClick={() => go("sync")}
            className={activePage === "sync" ? "active" : ""}
          >
            <Cloud size={20} />
            Sync
          </button>
        </nav>
      </div>
      {form &&
        props &&
        (form.kind === "sale" || form.kind === "load" ? (
          <TransactionForm
            {...props}
            kind={form.kind}
            initial={form.initial}
            close={() => setForm(null)}
          />
        ) : form.kind === "reconcile" ? (
          <ReconcileForm
            {...props}
            kind={form.kind}
            initial={form.initial}
            close={() => setForm(null)}
          />
        ) : (
          <RecordForm
            {...props}
            kind={form.kind}
            initial={form.initial}
            close={() => setForm(null)}
          />
        ))}
      {details && props && (
        <Detail
          {...props}
          kind={details.kind}
          row={details.row}
          close={() => setDetails(null)}
        />
      )}
      <CommandDialog
        open={search}
        onOpenChange={setSearch}
        title="Search your workspace"
        description="Find products, vehicles, sales and payments."
      >
        <CommandInput placeholder="Search products, vehicles, invoices..." />
        <CommandList>
          <CommandEmpty>No matching records.</CommandEmpty>
          <CommandGroup heading="Go to">
            {nav.map(([id, label, Icon]) => (
              <CommandItem
                key={id}
                value={"page " + label}
                onSelect={() => go(id)}
              >
                <Icon size={17} />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
          {s &&
            (["products", "vehicles", "sales", "payments"] as const)
              .filter((kind) => nav.some((n) => n[0] === kind))
              .map((kind) => (
                <CommandGroup heading={kind} key={kind}>
                  {s[kind].map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${kind} ${r.name || r.number || r.customer_name || ""} ${r.sku || ""} ${r.invoice_no ? "INV-" + String(r.invoice_no).padStart(6, "0") : ""} ${r.reference || ""}`}
                      onSelect={() => {
                        setSearch(false);
                        setDetails({ kind, row: r });
                      }}
                    >
                      {r.name || r.number || r.customer_name}
                      {r.invoice_no &&
                        ` · INV-${String(r.invoice_no).padStart(6, "0")}`}
                      {kind === "payments" && ` · ${r.amount}`}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
        </CommandList>
      </CommandDialog>
      <AlertDialog
        open={!!discard}
        onOpenChange={(v) => {
          if (!v) setDiscard(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove this rejected local transaction?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The server rejected this transaction without saving it. Remove it
              from this device so you can enter a corrected transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep transaction</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (discard) {
                  await removeLocal(discard.requestId);
                  await updateQueue();
                  setDiscard(null);
                }
              }}
            >
              Remove rejected transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {passwordOpen && <PasswordDialog close={() => setPasswordOpen(false)} />}
      <AlertDialog open={logoutConfirm} onOpenChange={setLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of your workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending.length
                ? `${pending.length} transactions are saved locally. Sync them successfully before signing out to avoid losing unsynced work.`
                : "Cached business information will be removed from this device."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending.length > 0}
              onClick={() => void signOut()}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
