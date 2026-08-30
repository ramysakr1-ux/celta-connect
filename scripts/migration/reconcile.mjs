// Makes a handful of tables match the source exactly, after the bulk copy.
//
// Three kinds of table cannot simply be inserted into:
//
//   * ones a MIGRATION seeds (assignment_type_definitions) -- the rows exist
//     before the copy runs, so copying the same rows again doubles them;
//   * ones a TRIGGER fills (staff_channels) -- inserting a course or a
//     subgroup provisions its chat channel automatically, so the copied
//     originals land alongside freshly minted ones;
//   * ones with no single id column (staff_channel_members), where a partly
//     completed earlier run cannot be resumed by upsert.
//
// For each, the target is made to equal the source: delete what the source
// does not have, insert what it is missing. Keyed on id where there is one,
// on the natural pair where there is not.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const readEnv = (file, keys) => {
  const t = fs.readFileSync(file, "utf8");
  return Object.fromEntries(keys.map((k) => [k, t.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim()]));
};
const o = readEnv(".env.local", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
const n = readEnv(".env.migration", ["NEW_SUPABASE_URL", "NEW_SERVICE_ROLE_KEY"]);
const OLD = createClient(o.NEXT_PUBLIC_SUPABASE_URL, o.SUPABASE_SERVICE_ROLE_KEY);
const NEW = createClient(n.NEW_SUPABASE_URL, n.NEW_SERVICE_ROLE_KEY);

const strip = (row, cols) => Object.fromEntries(Object.entries(row).filter(([k]) => !cols.includes(k)));

async function reconcileById(table, driftCols = []) {
  const { data: src } = await OLD.from(table).select("*");
  const { data: dst } = await NEW.from(table).select("id");
  const wanted = new Set((src ?? []).map((r) => r.id));
  const have = new Set((dst ?? []).map((r) => r.id));

  const extra = [...have].filter((id) => !wanted.has(id));
  if (extra.length) await NEW.from(table).delete().in("id", extra);

  const missing = (src ?? []).filter((r) => !have.has(r.id)).map((r) => strip(r, driftCols));
  if (missing.length) {
    const { error } = await NEW.from(table).insert(missing);
    if (error) console.log(`  ${table}: insert failed -- ${error.message}`);
  }
  const { count } = await NEW.from(table).select("*", { count: "exact", head: true });
  console.log(`  ${table}: source ${src?.length ?? 0}, removed ${extra.length}, added ${missing.length}, now ${count}`);
}

async function reconcilePair(table, a, b) {
  const { data: src } = await OLD.from(table).select("*");
  const { data: dst } = await NEW.from(table).select("*");
  const key = (r) => `${r[a]}::${r[b]}`;
  const have = new Set((dst ?? []).map(key));
  const missing = (src ?? []).filter((r) => !have.has(key(r)));
  if (missing.length) {
    const { error } = await NEW.from(table).insert(missing);
    if (error) console.log(`  ${table}: insert failed -- ${error.message}`);
  }
  const { count } = await NEW.from(table).select("*", { count: "exact", head: true });
  console.log(`  ${table}: source ${src?.length ?? 0}, added ${missing.length}, now ${count}`);
}

await reconcileById("staff_channels");
await reconcileById("assignment_type_definitions");
await reconcilePair("staff_channel_members", "channel_id", "profile_id");
