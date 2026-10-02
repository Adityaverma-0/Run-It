import { getChatGPTUser } from "@/app/chatgpt-auth";
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
  const user = await getChatGPTUser();
  if (!user) throw new AppError("Sign in to continue", 401);
  // The starter injects this identity only on loopback during development. Never persist its mock profile.
  if (process.env.NODE_ENV !== "production" && user.userId === "local_seedy")
    return {
      id: null,
      name: "Sanket",
      email: "",
      role: "owner",
      key: "local-preview",
      preview: true,
    };
  const rows = await query(
    "SELECT distribution.resolve_member($1,$2) AS member",
    [user.email, user.fullName || user.email],
  );
  const u = rows[0]?.member;
  if (!u)
    throw new AppError(
      "Your account does not have access. Ask your owner to add your email.",
      403,
    );
  return { ...u, key: user.userId };
}
export function responseError(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
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
    { status: business || duplicate || constraint ? 400 : 503 },
  );
}
