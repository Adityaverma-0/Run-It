import assert from "node:assert/strict";
const base = process.env.TEST_APP_URL || "http://127.0.0.1:5173";
// Only malformed or unauthenticated writes: this suite creates no business records.
for (const [name, path, options, expected] of [
  ["health", "/api/health", {}, 200],
  ["unauthenticated state", "/api/state", {}, 401],
  [
    "forged identity headers",
    "/api/state",
    {
      headers: {
        "oai-authenticated-user-id": "local_seedy",
        "oai-authenticated-user-email": "forged@example.invalid",
      },
    },
    401,
  ],
  [
    "cross-origin action",
    "/api/action",
    {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    },
    403,
  ],
  [
    "missing login data",
    "/api/auth/login",
    {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: "{}",
    },
    400,
  ],
  [
    "unknown auth route",
    "/api/auth/anything",
    {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: "{}",
    },
    404,
  ],
  [
    "inherited property is not an auth route",
    "/api/auth/toString",
    {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: "{}",
    },
    404,
  ],
  [
    "invalid session",
    "/api/state",
    {
      headers: {
        Cookie: "sanket_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    },
    401,
  ],
]) {
  const response = await fetch(base + path, options);
  assert.equal(response.status, expected, name);
  assert.equal(
    response.headers.get("cache-control"),
    "no-store",
    `${name}: no cache`,
  );
  console.log(`PASS ${name}: ${response.status}`);
}
const root = await fetch(base);
assert.equal(root.status, 200);
assert.equal(root.headers.get("x-content-type-options"), "nosniff");
assert.equal(root.headers.get("x-frame-options"), "DENY");
console.log("PASS production root and security headers");
const logout = await fetch(base + "/api/auth/logout", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: "{}",
});
assert.equal(logout.status, 200);
const cookie = logout.headers.get("set-cookie") || "";
for (const flag of ["HttpOnly", "Secure", "SameSite=lax", "Max-Age=0"])
  assert.ok(
    cookie.toLowerCase().includes(flag.toLowerCase()),
    `Missing cookie flag: ${flag}`,
  );
console.log("PASS sign-out clears the secure HttpOnly session cookie");
