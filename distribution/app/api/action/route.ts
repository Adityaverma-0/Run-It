import { member, responseError, AppError } from "@/lib/auth";
import { query } from "@/lib/db";
import { validate } from "@/lib/validation";
import { readJSON } from "@/lib/request";
export async function POST(req: Request) {
  try {
    const body = await readJSON(req);
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
