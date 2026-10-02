import { AppError } from "./auth";
import { allowedOrigin } from "./auth-crypto.ts";

export function assertOrigin(req: Request) {
  const localUrl = new URL(req.url);
  // Next's internal URL can use localhost even when the browser uses 127.0.0.1.
  // Use the actual Host for direct/local serving. Render always supplies the
  // canonical public URL, so forwarded headers cannot override it in production.
  if (req.headers.get("host")) localUrl.host = req.headers.get("host")!;
  if (
    !allowedOrigin(
      localUrl.href,
      req.headers.get("origin"),
      process.env.APP_URL || process.env.RENDER_EXTERNAL_URL,
    )
  )
    throw new AppError("Request origin not allowed", 403);
}
export async function readJSON(req: Request, maxBytes = 100000) {
  assertOrigin(req);
  if (
    req.headers.get("content-type")?.split(";")[0].trim() !== "application/json"
  )
    throw new AppError("JSON is required");
  if (Number(req.headers.get("content-length")) > maxBytes)
    throw new AppError("This request is too large", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new AppError("A request body is required");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError("This request is too large", 413);
    }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch {
    throw new AppError("Invalid JSON");
  }
}
