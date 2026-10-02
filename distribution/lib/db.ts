import { neon } from "@neondatabase/serverless";
import { env } from "cloudflare:workers";
export function sql() {
  const url =
    (env as unknown as Record<string, string>).DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!url) throw new Error("Database connection is not configured");
  return neon(url);
}
export async function query(text: string, params: any[] = []) {
  return sql().query(text, params) as Promise<any[]>;
}
