import { member, responseError, AppError } from "@/lib/auth";
import { query } from "@/lib/db";
import { validate } from "@/lib/validation";
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || origin !== new URL(req.url).origin)
      throw new AppError("Request origin not allowed", 403);
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new AppError("JSON is required");
    const text = await req.text();
    if (text.length > 100000)
      throw new AppError("This request is too large", 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("Invalid JSON");
    }
    if (
      !/^[0-9a-f-]{36}$/i.test(body.requestId || "") ||
      typeof body.action !== "string" ||
      !body.data ||
      Array.isArray(body.data)
    )
      throw new AppError("Invalid request");
    const u = await member();
    body.data = validate(body.action, body.data);
    const result = await query(
      "SELECT distribution.apply_action($1,$2::jsonb,$3::uuid,$4,$5,$6::uuid) AS result",
      [
        body.action,
        JSON.stringify(body.data),
        u.id,
        u.role,
        u.key,
        body.requestId,
      ],
    );
    return Response.json(result[0].result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return responseError(e);
  }
}
