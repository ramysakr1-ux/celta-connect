// Copies everything from the current project into the new one.
//
// Order matters and is worked out from the data, not from a hand-written
// list:
//
//   1. auth.users, with their UUIDs preserved -- profiles.id is a foreign
//      key onto auth.users.id, so a new id anywhere breaks every join in
//      the app. The admin API cannot set an id, so these go in over SQL.
//   2. public tables, inserted in repeated passes until nothing more will
//      go in. 144 tables have too tangled a dependency graph to order by
//      hand, and a wrong order fails as "0 rows" without saying why;
//      passes converge on the right order without anyone knowing it.
//   3. storage buckets and their objects.
//
// Reads only from the old project. Nothing here writes to it.
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import fs from "fs";

const readEnv = (file, keys) => {
  const t = fs.readFileSync(file, "utf8");
  return Object.fromEntries(keys.map((k) => [k, t.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim()]));
};
const oldEnv = readEnv(".env.local", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
const newEnv = readEnv(".env.migration", ["NEW_SUPABASE_URL", "NEW_SERVICE_ROLE_KEY", "NEW_DB_URL"]);
for (const [k, v] of Object.entries({ ...oldEnv, ...newEnv })) if (!v) throw new Error(`Missing ${k}`);

const OLD = createClient(oldEnv.NEXT_PUBLIC_SUPABASE_URL, oldEnv.SUPABASE_SERVICE_ROLE_KEY);
const NEW = createClient(newEnv.NEW_SUPABASE_URL, newEnv.NEW_SERVICE_ROLE_KEY);

function tablesFromMigrations() {
  const dir = "supabase/migrations";
  const names = new Set();
  for (const f of fs.readdirSync(dir).sort()) {
    const sql = fs.readFileSync(`${dir}/${f}`, "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) names.add(m[1]);
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) names.delete(m[1]);
  }
  return [...names].sort();
}

// ---- 1. auth users ----------------------------------------------------
const client = new pg.Client({ connectionString: newEnv.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { data: authPage } = await OLD.auth.admin.listUsers({ page: 1, perPage: 1000 });
const users = authPage?.users ?? [];
let authCopied = 0;
for (const u of users) {
  // Identity and confirmation only. Password hashes are deliberately NOT
  // carried: every account on this project is a demo, QA or dry-run
  // account plus Ramy's own, so nobody is locked out, and a magic link
  // re-establishes any of them. Moving credentials for no one's benefit
  // would be the wrong trade.
  await client.query(
    `insert into auth.users
       (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
             $2, $3, $4, $5, $6, $7, false, false)
     on conflict (id) do nothing`,
    [
      u.id,
      u.email,
      u.email_confirmed_at ?? new Date().toISOString(),
      u.created_at,
      u.updated_at,
      JSON.stringify(u.app_metadata ?? {}),
      JSON.stringify(u.user_metadata ?? {}),
    ]
  );
  authCopied++;
}
console.log(`auth users: ${authCopied}/${users.length}`);

// ---- 2. public tables -------------------------------------------------
const pending = new Map();
for (const t of tablesFromMigrations()) {
  const { data, error } = await OLD.from(t).select("*");
  if (error) {
    console.warn(`  read ${t}: ${error.message}`);
    continue;
  }
  if (data?.length) pending.set(t, data);
}
console.log(`tables with data to copy: ${pending.size}`);

// The old database has drifted from the migrations -- profiles there still
// carries connect_hub_link, which migration 0195 dropped, so the new project
// has no such column and the whole insert is rejected. Rather than curate a
// list of drifted columns by hand (which would go stale the moment the next
// one appears), drop whatever the target says it does not know about and
// retry. Anything dropped is reported, so drift is visible rather than
// silently discarded.
const dropped = new Map();
async function insertTable(t, rows) {
  let payload = rows;
  for (let attempt = 0; attempt < 20; attempt++) {
    // Not every table has an id -- staff_channel_members is keyed on its
    // pair of columns -- so fall back to a plain insert where upsert's
    // onConflict target does not exist.
    let { error } = await NEW.from(t).upsert(payload, { onConflict: "id", ignoreDuplicates: true });
    if (error && /column "id" does not exist|there is no unique or exclusion constraint/i.test(error.message)) {
      ({ error } = await NEW.from(t).insert(payload));
    }
    if (!error) return { ok: true, rows: payload.length };

    const missing = error.message.match(/Could not find the '([^']+)' column/)?.[1];
    if (!missing) return { ok: false, error };
    payload = payload.map((r) => {
      const { [missing]: _drop, ...rest } = r;
      return rest;
    });
    dropped.set(t, [...(dropped.get(t) ?? []), missing]);
  }
  return { ok: false, error: new Error("too many unknown columns") };
}

let pass = 0;
while (pending.size && pass < 12) {
  pass++;
  let moved = 0;
  for (const [t, rows] of [...pending.entries()]) {
    const res = await insertTable(t, rows);
    if (res.ok) {
      pending.delete(t);
      moved += rows.length;
      console.log(`  pass ${pass}: ${t} (${rows.length})`);
    }
  }
  if (moved === 0) break; // nothing further will go in; report why below
}
if (dropped.size) {
  console.log("columns the old database has that the migrations do not (drift):");
  for (const [t, cols] of dropped) console.log(`  ${t}: ${[...new Set(cols)].join(", ")}`);
}
if (pending.size) {
  console.log("STILL BLOCKED -- a real constraint problem, not ordering:");
  for (const [t, rows] of pending) {
    const res = await insertTable(t, rows);
    console.log(`  ${t} (${rows.length}): ${res.error?.message ?? "unknown"}`);
  }
}

// ---- 3. storage -------------------------------------------------------
const { data: buckets } = await OLD.storage.listBuckets();
for (const b of buckets ?? []) {
  await NEW.storage.createBucket(b.name, { public: b.public }).catch(() => {});
  let copied = 0;
  const walk = async (prefix) => {
    const { data } = await OLD.storage.from(b.name).list(prefix, { limit: 1000 });
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        await walk(path);
        continue;
      }
      const { data: file } = await OLD.storage.from(b.name).download(path);
      if (!file) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error } = await NEW.storage
        .from(b.name)
        .upload(path, buf, { contentType: item.metadata?.mimetype, upsert: true });
      if (!error) copied++;
    }
  };
  await walk("");
  console.log(`bucket ${b.name}: ${copied} objects`);
}

await client.end();
console.log("COPY COMPLETE -- next: node scripts/migration/inventory.mjs --new > after.json");
