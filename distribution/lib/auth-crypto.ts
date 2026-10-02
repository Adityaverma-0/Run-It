import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

export const sessionSeconds = 7 * 24 * 60 * 60;
export const newToken = () => randomBytes(32).toString("base64url");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const secretMatches = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(digest(a), "hex"), Buffer.from(digest(b), "hex"));

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string | null) {
  // Run the same expensive operation for unknown accounts to avoid a timing oracle.
  const [version, salt, hash] = (encoded || "").split("$");
  const valid =
    version === "scrypt-v1" &&
    /^[a-f0-9]{32}$/.test(salt || "") &&
    /^[a-f0-9]{128}$/.test(hash || "");
  const key = await derive(
    password,
    valid ? salt : "00000000000000000000000000000000",
  );
  return (
    timingSafeEqual(key, valid ? Buffer.from(hash, "hex") : Buffer.alloc(64)) &&
    valid
  );
}

export function allowedOrigin(
  requestUrl: string,
  origin: string | null,
  configuredOrigin?: string,
) {
  if (!origin) return false;
  try {
    const expected = new URL(configuredOrigin || requestUrl);
    if (!["http:", "https:"].includes(expected.protocol)) return false;
    return origin === expected.origin;
  } catch {
    return false;
  }
}
