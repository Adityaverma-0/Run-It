import fs from "node:fs";
import { spawnSync } from "node:child_process";
const url =
  process.env.DATABASE_URL ||
  fs
    .readFileSync(".env", "utf8")
    .split("\n")
    .find((x) => x.startsWith("DATABASE_URL="))
    ?.slice(13);
const schema = "distribution_test_" + Date.now();
const migration = fs
  .readFileSync("db/001_schema.sql", "utf8")
  .replace(/^BEGIN;/, "")
  .replace(/COMMIT;\s*$/, "");
const tests = fs.readFileSync("tests/business.sql", "utf8");
const sql =
  "BEGIN;\n" +
  (migration + tests).replaceAll("distribution", schema) +
  "\nROLLBACK;";
const p = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", url], {
  input: sql,
  encoding: "utf8",
});
console.log((p.stderr || "").replaceAll(url, "[redacted]"));
if (p.status) process.exit(1);
console.log(
  "All tests passed. Isolated test schema and fixtures rolled back. Production tables untouched.",
);
