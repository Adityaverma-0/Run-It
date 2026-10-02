import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const migrationUrl = new URL(connectionString);
if (
  ["require", "prefer", "verify-ca"].includes(
    migrationUrl.searchParams.get("sslmode"),
  )
)
  migrationUrl.searchParams.set("sslmode", "verify-full");
const client = new pg.Client({
  connectionString: migrationUrl.href,
  connectionTimeoutMillis: 20000,
});
try {
  await client.connect();
  // Serialize migrations and business writes, including simultaneous deployments.
  const dir = fileURLToPath(new URL("../db/", import.meta.url));
  const files = (await fs.readdir(dir))
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();
  const statements = [];
  for (const file of files) {
    statements.push(
      (await fs.readFile(new URL(`../db/${file}`, import.meta.url), "utf8"))
        .replace(/^BEGIN;\s*/, "")
        .replace(/COMMIT;\s*$/, ""),
    );
  }
  // A transaction-scoped lock also works with Neon's pooled endpoint.
  await client.query(
    "BEGIN; SELECT pg_advisory_xact_lock(hashtext('sanket-distribution-write'));\n" +
      statements.join("\n") +
      "\nCOMMIT;",
  );
  for (const file of files) console.log(`Database schema ready: ${file}`);
} catch (error) {
  // Never print connection details or server-provided error payloads.
  console.error(
    "Database migration failed. Check DATABASE_URL, network access and schema permissions.",
  );
  console.error(
    `Error code: ${/^[A-Z0-9_]+$/.test(error.code || "") ? error.code : "UNAVAILABLE"}`,
  );
  process.exitCode = 1;
  throw new Error("Startup stopped because the database migration failed.");
} finally {
  await client.end();
}
