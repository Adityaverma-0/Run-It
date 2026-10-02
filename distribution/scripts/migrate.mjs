import fs from "node:fs";
import { spawnSync } from "node:child_process";
const url =
  process.env.DATABASE_URL ||
  fs
    .readFileSync(".env", "utf8")
    .split("\n")
    .find((x) => x.startsWith("DATABASE_URL="))
    ?.slice(13);
if (!url) throw new Error("DATABASE_URL is required");
const result = spawnSync(
  "psql",
  ["-X", "-v", "ON_ERROR_STOP=1", "-d", url, "-f", "db/001_schema.sql"],
  { encoding: "utf8" },
);
console.log(result.stdout || "");
if (result.status) {
  console.error(
    (result.stderr || "Migration failed").replaceAll(url, "[redacted]"),
  );
  process.exit(1);
}
