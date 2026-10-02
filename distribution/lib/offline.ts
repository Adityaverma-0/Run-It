export type Pending = {
  requestId: string;
  action: string;
  data: any;
  userKey: string;
  createdAt: string;
  status: "pending" | "failed";
  error?: string;
  rejected?: boolean;
};
const db = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("sanket-field-operations", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("cache");
      r.result.createObjectStore("queue", { keyPath: "requestId" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function readLocal(store: string, key?: string) {
  const d = await db();
  return new Promise<any>((resolve, reject) => {
    const tx = d.transaction(store, "readonly");
    const r = key
      ? tx.objectStore(store).get(key)
      : tx.objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => d.close();
  });
}
export async function writeLocal(store: string, value: any, key?: string) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction(store, "readwrite");
    key
      ? tx.objectStore(store).put(value, key)
      : tx.objectStore(store).put(value);
    tx.oncomplete = () => {
      d.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function removeLocal(id: string) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("queue", "readwrite");
    tx.objectStore("queue").delete(id);
    tx.oncomplete = () => {
      d.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function clearLocal() {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction(["cache", "queue"], "readwrite");
    tx.objectStore("cache").clear();
    tx.objectStore("queue").clear();
    tx.oncomplete = () => {
      d.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function sendAction(body: any) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const result: any = await res.json();
  if (!res.ok) {
    const e = new Error(result.error || "Request failed") as any;
    e.status = res.status;
    throw e;
  }
  return result;
}
