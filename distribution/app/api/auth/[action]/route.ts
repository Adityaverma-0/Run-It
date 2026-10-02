import { z } from "zod";
import {
  AppError,
  member,
  responseError,
  createSession,
  endSession,
} from "@/lib/auth";
import {
  digest,
  hashPassword,
  verifyPassword,
  newToken,
  secretMatches,
} from "@/lib/auth-crypto.ts";
import { readJSON } from "@/lib/request";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const password = z
  .string()
  .min(12, "Use at least 12 characters for your password.")
  .max(128, "Use at most 128 characters.");
const token = z.string().min(32).max(256);
const schemas = {
  login: z.object({ email, password: z.string().min(1).max(128) }),
  setup: z.object({
    email,
    name: z.string().trim().min(1).max(100),
    password,
    token,
  }),
  recover: z.object({ email, password, token }),
  accept: z.object({
    email,
    password,
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }),
  password: z.object({ currentPassword: z.string().min(1).max(128), password }),
  invite: z.object({ userId: z.string().uuid() }),
  logout: z.object({}),
};
async function limit(key: string, count: number) {
  const rows = await query("SELECT distribution.auth_limit($1,$2) AS allowed", [
    digest(key),
    count,
  ]);
  if (!rows[0].allowed)
    throw new AppError(
      "Too many attempts. Please try again in 15 minutes.",
      429,
    );
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await ctx.params;
    if (!Object.hasOwn(schemas, action)) throw new AppError("Not found", 404);
    const parsed = schemas[action as keyof typeof schemas].safeParse(
      await readJSON(req, 8192),
    );
    if (!parsed.success)
      throw new AppError(
        parsed.error.issues[0]?.message || "Check the entered values.",
      );
    const data = parsed.data as any;
    if (action === "logout") {
      await endSession();
    } else if (action === "invite") {
      const u = await member();
      if (u.role !== "owner")
        throw new AppError("Only the owner can manage access", 403);
      await limit(`invite:${u.id}`, 50);
      const value = newToken();
      await query("SELECT distribution.auth_invite($1::uuid,$2::uuid,$3)", [
        u.id,
        data.userId,
        digest(value),
      ]);
      // A fragment keeps the raw token out of request logs and Referer headers.
      return Response.json(
        { path: `/#activate=${value}`, expiresIn: "24 hours" },
        { headers: { "Cache-Control": "no-store" } },
      );
    } else if (action === "password") {
      const u = await member();
      await limit(`password:${u.id}`, 10);
      const [credential] = await query(
        "SELECT password_hash FROM distribution.auth_credentials WHERE user_id=$1::uuid",
        [u.id],
      );
      if (
        !(await verifyPassword(data.currentPassword, credential?.password_hash))
      )
        throw new AppError("Your current password is incorrect.", 401);
      const hash = await hashPassword(data.password);
      await query("SELECT distribution.auth_password($1::uuid,$2,$3)", [
        u.id,
        credential.password_hash,
        hash,
      ]);
      await createSession(u.id!, hash);
    } else {
      // Database-backed throttles survive restarts and apply across service instances.
      await limit("public-auth", 200);
      await limit(`public-auth:${data.email}`, 10);
      let userId: string;
      let hash: string;
      if (action === "login") {
        const [u] = await query(
          "SELECT u.id,u.active,c.password_hash FROM distribution.users u LEFT JOIN distribution.auth_credentials c ON c.user_id=u.id WHERE u.email=$1",
          [data.email],
        );
        const correct = await verifyPassword(data.password, u?.password_hash);
        if (!correct || !u?.active)
          throw new AppError(
            "Email or password is incorrect, or the account is inactive.",
            401,
          );
        userId = u.id;
        hash = u.password_hash;
      } else if (action === "accept") {
        hash = await hashPassword(data.password);
        const [u] = await query(
          "SELECT distribution.auth_accept($1,$2,$3) AS id",
          [digest(data.token), data.email, hash],
        );
        userId = u.id;
      } else {
        await limit("owner-setup", 5);
        const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
        const setupToken = process.env.OWNER_SETUP_TOKEN;
        if (!ownerEmail || !setupToken || setupToken.length < 32)
          throw new AppError(
            "Set OWNER_EMAIL and an OWNER_SETUP_TOKEN of at least 32 characters in your server environment first.",
            503,
          );
        if (!secretMatches(data.token, setupToken) || data.email !== ownerEmail)
          throw new AppError(
            "The owner email or setup token is incorrect.",
            401,
          );
        hash = await hashPassword(data.password);
        const [u] = await query(
          "SELECT distribution.auth_owner($1,$2,$3,$4) AS id",
          [data.email, data.name || "", hash, action === "recover"],
        );
        userId = u.id;
      }
      await createSession(userId, hash);
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return responseError(e);
  }
}
