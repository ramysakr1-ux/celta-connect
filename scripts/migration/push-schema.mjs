// Builds the new project's schema by replaying the repo's own migrations.
//
// Deliberately not a pg_dump of the old database: the migrations ARE the
// source of truth for what the code expects, and replaying them proves the
// new project matches the repo rather than matching whatever drift has
// accumulated in the old one. If a migration fails here, that is worth
// knowing before any data moves.
//
// The connection string is read from .env.migration inside this process and
// passed to the CLI as an argument of a spawned child -- it is never echoed
// and never sits in shell history.
import { spawn } from "child_process";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.migration", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const dbUrl = env.NEW_DB_URL;
if (!dbUrl) throw new Error("NEW_DB_URL missing -- run create-project.mjs first");

console.log(`pushing ${fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).length} migrations`);

const child = spawn(
  "npx",
  ["--yes", "supabase@latest", "db", "push", "--db-url", dbUrl, "--include-all"],
  { stdio: ["ignore", "pipe", "pipe"] }
);

const scrub = (s) => s.replaceAll(dbUrl, "<db-url>").replace(/postgresql:\/\/[^\s"']+/g, "<db-url>");
child.stdout.on("data", (d) => process.stdout.write(scrub(d.toString())));
child.stderr.on("data", (d) => process.stderr.write(scrub(d.toString())));
child.on("close", (code) => {
  console.log(code === 0 ? "SCHEMA PUSHED" : `FAILED (exit ${code})`);
  process.exit(code ?? 1);
});
