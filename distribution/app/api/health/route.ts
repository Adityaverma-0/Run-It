import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await query("SELECT 1 FROM distribution.auth_sessions LIMIT 0");
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
