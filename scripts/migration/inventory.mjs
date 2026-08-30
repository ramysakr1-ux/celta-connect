// Baseline inventory of a Supabase project: every public table's row count,
// every storage bucket's object count and total bytes.
//
// Run against the OLD project before migrating and the NEW one after; the
// two outputs must match. Written as a file rather than a one-off command
// precisely so the "after" run is provably the same check as the "before"
// one -- a migration verified by two differently-worded queries is not
// verified at all.
//
//   node scripts/migration/inventory.mjs > before.json
//   node scripts/migration/inventory.mjs --new > after.json
//   node scripts/migration/inventory.mjs --diff before.json after.json
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function envFrom(file, keys) {
  const text = fs.readFileSync(file, "utf8");
  const out = {};
  for (const k of keys) {
    const m = text.match(new RegExp(`^${k}=(.+)$`, "m"));
    if (m) out[k] = m[1].trim();
  }
  return out;
}

// Table names come from the migrations themselves rather than a hand-kept
// list, so a table added later cannot silently escape the check.
function tablesFromMigrations() {
  const dir = "supabase/migrations";
  const names = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".sql")) continue;
    const sql = fs.readFileSync(`${dir}/${f}`, "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
      names.add(m[1]);
    }
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
      names.delete(m[1]);
    }
  }
  return [...names].sort();
}

async function inventory(url, key) {
  const s = createClient(url, key);
  const tables = {};
  for (const t of tablesFromMigrations()) {
    const { count, error } = await s.from(t).select("*", { count: "exact", head: true });
    // A table the migrations create but PostgREST cannot see is worth
    // recording as an error rather than skipping -- silence is how the
    // volunteer attendance bug survived.
    tables[t] = error ? `ERROR: ${error.message}` : count;
  }
  const buckets = {};
  const { data: bucketList } = await s.storage.listBuckets();
  for (const b of bucketList ?? []) {
    let objects = 0;
    let bytes = 0;
    const walk = async (prefix) => {
      const { data } = await s.storage.from(b.name).list(prefix, { limit: 1000 });
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) await walk(path);
        else {
          objects += 1;
          bytes += item.metadata?.size ?? 0;
        }
      }
    };
    await walk("");
    buckets[b.name] = { objects, bytes };
  }
  return { tables, buckets };
}

const args = process.argv.slice(2);
if (args[0] === "--diff") {
  const a = JSON.parse(fs.readFileSync(args[1], "utf8"));
  const b = JSON.parse(fs.readFileSync(args[2], "utf8"));
  let bad = 0;
  for (const t of Object.keys(a.tables)) {
    if (String(a.tables[t]) !== String(b.tables[t])) {
      console.log(`  MISMATCH ${t}: before=${a.tables[t]} after=${b.tables[t]}`);
      bad++;
    }
  }
  for (const k of Object.keys(a.buckets)) {
    const x = a.buckets[k];
    const y = b.buckets[k];
    if (!y || x.objects !== y.objects) {
      console.log(`  MISMATCH bucket ${k}: before=${x.objects} after=${y?.objects ?? "missing"}`);
      bad++;
    }
  }
  console.log(bad === 0 ? "IDENTICAL -- every table and bucket matches" : `${bad} MISMATCHES`);
  process.exit(bad === 0 ? 0 : 1);
}

const useNew = args.includes("--new");
const env = useNew
  ? envFrom(".env.migration", ["NEW_SUPABASE_URL", "NEW_SERVICE_ROLE_KEY"])
  : envFrom(".env.local", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
const url = useNew ? env.NEW_SUPABASE_URL : env.NEXT_PUBLIC_SUPABASE_URL;
const key = useNew ? env.NEW_SERVICE_ROLE_KEY : env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error(useNew ? "Missing NEW_* values in .env.migration" : "Missing values in .env.local");

console.log(JSON.stringify(await inventory(url, key), null, 2));
