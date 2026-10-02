import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  digest,
  newToken,
  secretMatches,
  allowedOrigin,
} from "../lib/auth-crypto.ts";

test("passwords are salted and verified without storing plaintext", async () => {
  const input = "isolated-test-passphrase";
  const a = await hashPassword(input),
    b = await hashPassword(input);
  assert.notEqual(a, b);
  assert.equal(a.includes(input), false);
  assert.equal(await verifyPassword(input, a), true);
  assert.equal(await verifyPassword("wrong-passphrase", a), false);
  assert.equal(await verifyPassword(input, null), false);
  assert.equal(await verifyPassword(input, "malformed"), false);
});
test("opaque tokens have 256 bits of entropy and are stored as hashes", () => {
  const a = newToken(),
    b = newToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.equal(digest(a).length, 64);
  assert.notEqual(digest(a), a);
  assert.equal(secretMatches(a, a), true);
  assert.equal(secretMatches(a, b), false);
  assert.equal(secretMatches("", a), false);
});
test("CSRF accepts the configured HTTPS Render origin behind an HTTP proxy", () => {
  const internal = "http://localhost:10000/api/action",
    external = "https://workspace.onrender.com";
  assert.equal(allowedOrigin(internal, external, external), true);
  assert.equal(
    allowedOrigin(internal, "https://attacker.example", external),
    false,
  );
  assert.equal(
    allowedOrigin(
      internal,
      "https://workspace.onrender.com.attacker.example",
      external,
    ),
    false,
  );
  assert.equal(
    allowedOrigin(internal, "http://localhost:10000", external),
    false,
  );
  assert.equal(allowedOrigin(internal, null, external), false);
  assert.equal(allowedOrigin(internal, "null", external), false);
  assert.equal(allowedOrigin(internal, external, "not a URL"), false);
  assert.equal(
    allowedOrigin("http://127.0.0.1:5173/api/action", "http://127.0.0.1:5173"),
    true,
  );
});
