import { cookies } from "next/headers";
import { digest, newToken, sessionSeconds } from "./auth-crypto.ts";
import { query } from "./db";
export type Member = {
  id: string | null;
  name: string;
  email: string;
  role: string;
  key: string;
  preview?: boolean;
};
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function member(): Promise<Member> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError("Sign in to continue", 401);
  const rows = await query(
    "SELECT u.id,u.name,u.email,u.role FROM distribution.auth_sessions s JOIN distribution.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active",
    [digest(token)],
  );
  const u = rows[0];
  if (!u) throw new AppError("Your session expired. Sign in again.", 401);
  return { ...u, key: u.id } as Member;
}
export const cookieName = "sanket_session";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: sessionSeconds,
});
export async function createSession(
  userId: string,
  expectedPasswordHash: string,
) {
  const token = newToken();
  const rows = await query(
    "SELECT distribution.auth_session($1,$2::uuid,$3) AS user_id",
    [digest(token), userId, expectedPasswordHash],
  );
  if (!rows[0]?.user_id)
    throw new AppError("Your account changed. Please sign in again.", 401);
  const jar = await cookies();
  const previous = jar.get(cookieName)?.value;
  if (previous)
    await query("DELETE FROM distribution.auth_sessions WHERE token_hash=$1", [
      digest(previous),
    ]);
  jar.set(cookieName, token, cookieOptions());
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token)
    await query("DELETE FROM distribution.auth_sessions WHERE token_hash=$1", [
      digest(token),
    ]);
  jar.set(cookieName, "", { ...cookieOptions(), maxAge: 0 });
}
export function responseError(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  const e = error as any;
  const business = e.code === "P0001";
  const duplicate = e.code === "23505";
  const constraint = [
    "23514",
    "22P02",
    "23502",
    "22003",
    "22007",
    "23503",
  ].includes(e.code);
  return Response.json(
    {
      error: business
        ? e.message
        : duplicate
          ? "This record already exists. Check its SKU, number or email."
          : constraint
            ? "Please check the entered values and linked records."
            : "The database is unavailable. Your changes have not been confirmed. Please retry.",
    },
    {
      status: business || duplicate || constraint ? 400 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
