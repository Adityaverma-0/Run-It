import { member, AppError, responseError } from "@/lib/auth";
import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await member();
    if (!["owner", "worker"].includes(u.role))
      throw new AppError("You do not have access to team daily reports", 403);
    const value = new URL(req.url).searchParams.get("day") || "";
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new AppError("Choose a valid report date");
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (value > today) throw new AppError("Choose today or a previous day");
    const client = sql();
    const [summary, submissions] = await client.transaction(
      [
        client.query("SELECT distribution.daily_summary($1::date) AS summary", [
          value,
        ]),
        client.query(
          `SELECT r.*,u.name AS submitted_by_name,a.name AS reviewed_by_name FROM distribution.daily_reports r JOIN distribution.users u ON u.id=r.submitted_by LEFT JOIN distribution.users a ON a.id=r.reviewed_by WHERE r.report_day=$1::date ${u.role === "owner" ? "" : "AND r.submitted_by=$2::uuid"} ORDER BY r.submitted_at DESC`,
          u.role === "owner" ? [value] : [value, u.id],
        ),
      ],
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
    return Response.json(
      { summary: summary[0].summary, submissions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return responseError(e);
  }
}
