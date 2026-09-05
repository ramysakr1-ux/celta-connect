// Ask PostgREST to reload its schema cache (after a migration adds a
// function or column), and confirm the two hub bundle functions are
// callable by the service role. Read-only apart from the NOTIFY.
import fs from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const read = (f) => Object.fromEntries(fs.readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
const envm = read(".env.migration");
const env = read(".env.local");

const c = new pg.Client({ connectionString: envm.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const priv = await c.query(
  `select p.proname, has_function_privilege($1, p.oid, $2) as service_role_can_execute, has_function_privilege($3, p.oid, $2) as authenticated_can_execute
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $4 and p.proname like $5`,
  ["service_role", "execute", "authenticated", "public", "hub_%_bundle"]
);
console.log(priv.rows);
await c.query("NOTIFY pgrst, 'reload schema'");
console.log("schema reload requested");
await c.end();

await new Promise((r) => setTimeout(r, 6000));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: p } = await admin.from("profiles").select("course_id").eq("email", "demo-trainer@celtaconnect.com").maybeSingle();
for (const fn of ["hub_roster_bundle", "hub_today_bundle"]) {
  const t = performance.now();
  const r = await admin.rpc(fn, { p_course_id: p.course_id });
  console.log(fn, "->", r.error ? "ERROR: " + r.error.message : "ok, keys=" + Object.keys(r.data).length, Math.round(performance.now() - t) + "ms");
}
