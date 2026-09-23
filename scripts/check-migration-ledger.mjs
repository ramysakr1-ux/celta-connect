// Does the database agree with supabase/migrations?
//
// Written 23 Sep 2026, after an hour lost to a migration that reported the
// right numbers against the wrong database. Two things made that possible and
// this script closes both:
//
//   1. supabase_migrations.schema_migrations had stopped at 0264 while the
//      repo was at 0311 -- 47 migrations applied by hand with no record. So
//      there was no way to ask "what has landed here?" except by inspecting
//      the schema column by column.
//   2. PostgREST's stale schema cache produces the IDENTICAL error to a
//      migration that never ran ("column ... does not exist"), so the obvious
//      check is the one that cannot tell them apart.
//
// Hence: this talks to Postgres directly, never through PostgREST.
//
// Two passes.
//
//   LEDGER  every migration file has a row, and every row has a file.
//   OBJECTS for migrations with NO ledger row -- whose application is exactly
//           what is in doubt -- check that the objects they create are really
//           there. A ledger row is only a claim; this is evidence.
//
// --all scans every migration instead, which is a REVIEW, not a test: an
// object created by 0117 and dropped by 0304 is correctly absent, so a clean
// run is not expected and a hit is not a failure. Use it to hunt drift by
// hand, as on 23 Sep 2026 when it showed production carrying a stricter
// assignment_appendices policy under a different name than 0302 writes (see
// 0312).
//
// Usage:
//   node scripts/check-migration-ledger.mjs             ledger only (fast)
//   node scripts/check-migration-ledger.mjs --objects   + verify unrecorded ones
//   node scripts/check-migration-ledger.mjs --objects --all   review everything
//
// Reads NEW_DB_URL from .env.migration -- the direct Postgres connection,
// which is the only thing that can answer these questions.

import fs from "node:fs";
import pg from "pg";

const OBJECTS = process.argv.includes("--objects");
const ALL = process.argv.includes("--all");

const read = (f) =>
  Object.fromEntries(
    fs
      .readFileSync(f, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );

const url = read(".env.migration").NEW_DB_URL;
if (!url) {
  console.error("NEW_DB_URL missing from .env.migration");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const rows = async (sql, args) => (await client.query(sql, args)).rows;

// Say which database, every time. The whole reason this script exists is that
// the right SQL ran against the wrong one.
const [{ db, host }] = await rows("select current_database() db, inet_server_addr()::text host");
console.log(`database: ${db} @ ${new URL(url).host}${host ? ` (${host})` : ""}\n`);

let failed = false;

// ---- pass one: the ledger -------------------------------------------------
const files = fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
const ledger = new Map((await rows("select version, name from supabase_migrations.schema_migrations")).map((r) => [r.version, r.name]));

const missing = files.filter((f) => !ledger.has(f.slice(0, 4)));
const orphans = [...ledger.keys()].filter((v) => !files.some((f) => f.slice(0, 4) === v));

console.log(`LEDGER  ${files.length} migration files, ${ledger.size} rows`);
if (missing.length) {
  failed = true;
  console.log(`  ${missing.length} file(s) with no ledger row -- applied by hand, or never applied:`);
  for (const f of missing) console.log(`    ${f}`);
}
if (orphans.length) {
  failed = true;
  console.log(`  ${orphans.length} ledger row(s) with no file: ${orphans.join(", ")}`);
}
if (!missing.length && !orphans.length) console.log("  ok -- every file has a row and every row has a file");

// ---- pass two: the objects ------------------------------------------------
if (OBJECTS) {
  const set = async (sql, key = (r) => Object.values(r)[0]) => new Set((await rows(sql)).map(key));
  const tables = await set(`select table_name from information_schema.tables where table_schema='public'`);
  const views = await set(`select table_name from information_schema.views where table_schema='public'`);
  const columns = await set(`select table_name||'.'||column_name from information_schema.columns where table_schema='public'`);
  const indexes = await set(`select indexname from pg_indexes where schemaname='public'`);
  const functions = await set(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`);
  // Policies are matched across ALL schemas: several live on storage.objects.
  // And Postgres truncates identifiers at 63 bytes, so compare on that prefix
  // or every long policy name reads as missing.
  const policies = await set(`select policyname from pg_policies`);
  const constraints = await set(`select conname from pg_constraint`);
  const types = await set(`select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public'`);
  const triggers = await set(`select tgname from pg_trigger where not tgisinternal`);

  const hasPolicy = (name) => policies.has(name) || policies.has(name.slice(0, 63));
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const id = (s) => s.replace(/^public\./i, "").replace(/^"|"$/g, "").toLowerCase();

  // Only the migrations whose application is unknown, unless --all. Scanning
  // history is a review: later migrations legitimately drop and rename what
  // earlier ones created, so absence there is expected, not drift.
  const scope = ALL ? files : files.filter((f) => !ledger.has(f.slice(0, 4)));
  const problems = [];
  for (const f of scope) {
    const sql = strip(fs.readFileSync(`supabase/migrations/${f}`, "utf8"));
    const claimed = [];
    const scan = (pattern, make) => {
      const re = new RegExp(pattern, "gi");
      let m;
      while ((m = re.exec(sql))) claimed.push(make(m));
    };
    scan(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)`, (m) => ["table", id(m[1]), tables.has(id(m[1]))]);
    scan(String.raw`create\s+(?:or\s+replace\s+)?view\s+([\w."]+)`, (m) => ["view", id(m[1]), views.has(id(m[1]))]);
    scan(String.raw`alter\s+table\s+(?:if\s+exists\s+)?([\w."]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([\w"]+)`, (m) => ["column", `${id(m[1])}.${id(m[2])}`, columns.has(`${id(m[1])}.${id(m[2])}`)]);
    scan(String.raw`create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([\w."]+)`, (m) => ["index", id(m[1]), indexes.has(id(m[1]))]);
    scan(String.raw`create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(`, (m) => ["function", id(m[1]), functions.has(id(m[1]))]);
    scan(String.raw`create\s+policy\s+"([^"]+)"`, (m) => ["policy", m[1], hasPolicy(m[1])]);
    scan(String.raw`add\s+constraint\s+([\w"]+)`, (m) => ["constraint", id(m[1]), constraints.has(id(m[1]))]);
    scan(String.raw`create\s+type\s+([\w."]+)`, (m) => ["type", id(m[1]), types.has(id(m[1]))]);
    scan(String.raw`create\s+trigger\s+([\w."]+)`, (m) => ["trigger", id(m[1]), triggers.has(id(m[1]))]);

    const absent = claimed.filter(([, , ok]) => !ok);
    if (absent.length) problems.push({ f, absent, total: claimed.length });
  }

  console.log(`\nOBJECTS  ${scope.length} migration(s) read${ALL ? " (review of all history)" : " (unrecorded only)"}`);
  if (scope.length === 0) {
    console.log("  nothing to check -- every migration has a ledger row");
  } else if (problems.length === 0) {
    console.log("  ok -- every object these migrations create is present");
  } else {
    // A hit in --all mode is something to look at, not a failure: see above.
    if (!ALL) failed = true;
    console.log(`  ${problems.length} migration(s) whose DDL is not all present:`);
    for (const p of problems) {
      console.log(`    ${p.f}  (${p.absent.length} of ${p.total})`);
      for (const [kind, name] of p.absent) console.log(`       ${kind} ${name}`);
    }
    console.log(
      ALL
        ? "\n  In --all mode most of these are SUPERSESSION, not drift: 0304 drops\n" +
          "  applicants.task_feedback_ai_accepted, which 0117 created, so its\n" +
          "  absence is correct. Read each one before concluding anything."
        : "\n  A missing object can mean the migration never ran, OR that the\n" +
          "  database was changed afterwards without a migration -- 0302 was the\n" +
          "  second kind: production carried a STRICTER policy under a different\n" +
          "  name. Check which before assuming."
    );
  }
}

await client.end();
console.log(failed ? "\nDRIFT" : "\nClean.");
process.exit(failed ? 1 : 0);
