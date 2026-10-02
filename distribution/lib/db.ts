import { neon } from "@neondatabase/serverless";
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Database connection is not configured");
  return neon(url);
}
export async function query(text: string, params: any[] = []) {
  return sql().query(text, params) as Promise<any[]>;
}
