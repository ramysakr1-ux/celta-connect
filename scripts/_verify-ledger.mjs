import fs from "node:fs";
import pg from "pg";
const read = (f) => Object.fromEntries(fs.readFileSync(f,"utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")];}));
const c = new pg.Client({ connectionString: read(".env.migration").NEW_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// --- what the live schema actually has ------------------------------------
const q = async (sql) => (await c.query(sql)).rows;
const tables = new Set((await q(`select table_name from information_schema.tables where table_schema='public'`)).map(r=>r.table_name));
const columns = new Set((await q(`select table_name||'.'||column_name k from information_schema.columns where table_schema='public'`)).map(r=>r.k));
const indexes = new Set((await q(`select indexname from pg_indexes where schemaname='public'`)).map(r=>r.indexname));
const functions = new Set((await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).map(r=>r.proname));
const policies = new Set((await q(`select policyname from pg_policies where schemaname='public'`)).map(r=>r.policyname));
const constraints = new Set((await q(`select conname from pg_constraint`)).map(r=>r.conname));
const types = new Set((await q(`select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public'`)).map(r=>r.typname));
const triggers = new Set((await q(`select tgname from pg_trigger where not tgisinternal`)).map(r=>r.tgname));
const views = new Set((await q(`select table_name from information_schema.views where table_schema='public'`)).map(r=>r.table_name));

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").filter(l => !l.trim().startsWith("--")).join("\n");
const id = (s) => s.replace(/^public\./i, "").replace(/^"|"$/g, "").toLowerCase();

function claims(sql) {
  const out = [];
  const add = (kind, name, has) => out.push({ kind, name, ok: has });
  let m;
  const re = (p, f) => { const r = new RegExp(p, "gi"); while ((m = r.exec(sql))) f(m); };
  re(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)`, (m) => add("table", id(m[1]), tables.has(id(m[1]))));
  re(String.raw`create\s+(?:or\s+replace\s+)?view\s+([\w."]+)`, (m) => add("view", id(m[1]), views.has(id(m[1]))));
  re(String.raw`alter\s+table\s+(?:if\s+exists\s+)?([\w."]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([\w"]+)`, (m) => add("column", `${id(m[1])}.${id(m[2])}`, columns.has(`${id(m[1])}.${id(m[2])}`)));
  re(String.raw`create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([\w."]+)`, (m) => add("index", id(m[1]), indexes.has(id(m[1]))));
  re(String.raw`create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(`, (m) => add("function", id(m[1]), functions.has(id(m[1]))));
  re(String.raw`create\s+policy\s+"([^"]+)"`, (m) => add("policy", m[1], policies.has(m[1])));
  re(String.raw`add\s+constraint\s+([\w"]+)`, (m) => add("constraint", id(m[1]), constraints.has(id(m[1]))));
  re(String.raw`create\s+type\s+([\w."]+)`, (m) => add("type", id(m[1]), types.has(id(m[1]))));
  re(String.raw`create\s+trigger\s+([\w."]+)`, (m) => add("trigger", id(m[1]), triggers.has(id(m[1]))));
  return out;
}

const files = fs.readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort();
const tracked = new Set((await q(`select version from supabase_migrations.schema_migrations`)).map(r=>r.version));

const results = [];
for (const f of files) {
  const version = f.slice(0, 4);
  if (tracked.has(version)) continue;
  const sql = strip(fs.readFileSync(`supabase/migrations/${f}`, "utf8"));
  const cl = claims(sql);
  const missing = cl.filter(x => !x.ok);
  const verdict = cl.length === 0 ? "NO-DDL" : missing.length === 0 ? "APPLIED" : missing.length === cl.length ? "NOT-APPLIED" : "PARTIAL";
  results.push({ version, f, verdict, checked: cl.length, missing });
}

const by = (v) => results.filter(r => r.verdict === v);
console.log(`untracked migrations: ${results.length}\n`);
for (const v of ["APPLIED", "NO-DDL", "PARTIAL", "NOT-APPLIED"]) {
  const rs = by(v);
  console.log(`${v}: ${rs.length}`);
  if (v !== "APPLIED") for (const r of rs) {
    console.log(`   ${r.f}${r.missing.length ? "  missing: " + r.missing.map(x=>`${x.kind} ${x.name}`).slice(0,4).join(", ") : "  (no checkable DDL -- data-only or DDL this parser cannot see)"}`);
  }
  console.log();
}
fs.writeFileSync("/private/tmp/claude-502/-Users-work-CELTA-connect-code-prompt/023670ec-6b2e-479a-b3aa-d7920070f574/scratchpad/ledger.json", JSON.stringify(results, null, 2));
await c.end();
