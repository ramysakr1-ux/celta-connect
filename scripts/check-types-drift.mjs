// Compare src/lib/supabase/types.ts against the live schema.
//
// That file is NOT a `supabase gen types` dump and must not be replaced with
// one: it is curated. It exports helper types the generator does not produce
// (CriteriaRating and friends), and it deliberately loosens or tightens
// shapes the app relies on. Overwriting it with the real generator output
// produced 465 type errors, 14 Sep 2026.
//
// So the generator is used as a MIRROR, not a source: generate to a temp
// file, compare, and report what has drifted. Fix the curated file by hand
// from the report.
//
// Run: node scripts/check-types-drift.mjs      (needs SUPABASE_ACCESS_TOKEN)
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

const REF = "hekwdwkocrkcexjorlfv";
const CURATED = "src/lib/supabase/types.ts";

if (!process.env.SUPABASE_ACCESS_TOKEN && fs.existsSync(".env.local")) {
  const m = fs.readFileSync(".env.local", "utf8").match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
  if (m) process.env.SUPABASE_ACCESS_TOKEN = m[1].trim().replace(/^['"]|['"]$/g, "");
}
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error("No SUPABASE_ACCESS_TOKEN — add it to .env.local. See scripts/gen-types.sh.");
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `types-live-${Date.now()}.ts`);
execSync(`npx supabase gen types typescript --project-id ${REF} > ${tmp}`, { stdio: ["ignore","ignore","inherit"] });
if (!fs.readFileSync(tmp, "utf8").includes("export type Database")) {
  console.error("The generator did not return a types file.");
  process.exit(1);
}

/** table -> Set(columns), from the Row block of each table. */
function parse(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = new Map();
  // The generator omits the trailing semicolons the curated file has, so
  // both endings have to be accepted or one side parses as zero tables.
  const re = /^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\};?$/gm;
  // Some entries in the curated file declare Row on ONE line
  // (`Row: { id: string; name: string };`). Missing those reported a table
  // as absent and produced a duplicate when it was "added".
  const single = /^ {6}(\w+): \{\n {8}Row: \{ (.*?) \};$/gm;
  let m;
  while ((m = single.exec(src))) {
    const cols = m[2].split(";").map((l) => l.trim()).filter(Boolean).map((l) => l.split(":")[0].replace("?", "").trim());
    out.set(m[1], new Set(cols));
  }
  while ((m = re.exec(src))) {
    const cols = m[2].split("\n").map((l) => l.trim()).filter((l) => /^\w+\??:/.test(l))
      .map((l) => l.split(":")[0].replace("?", ""));
    out.set(m[1], new Set(cols));
  }
  return out;
}

const live = parse(tmp);
const curated = parse(CURATED);
fs.unlinkSync(tmp);

const missingTables = [...live.keys()].filter((t) => !curated.has(t));
const staleTables = [...curated.keys()].filter((t) => !live.has(t));
const missingCols = [], staleCols = [];
for (const [t, cols] of live) {
  if (!curated.has(t)) continue;
  for (const c of cols) if (!curated.get(t).has(c)) missingCols.push(`${t}.${c}`);
  for (const c of curated.get(t)) if (!cols.has(c)) staleCols.push(`${t}.${c}`);
}

const show = (label, list) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length})`);
  for (const x of list) console.log("  " + x);
};
console.log(`live schema: ${live.size} tables | curated file: ${curated.size} tables`);
show("IN THE DATABASE, MISSING FROM THE CURATED FILE — tables", missingTables);
show("IN THE DATABASE, MISSING FROM THE CURATED FILE — columns", missingCols);
show("IN THE CURATED FILE, GONE FROM THE DATABASE — tables", staleTables);
show("IN THE CURATED FILE, GONE FROM THE DATABASE — columns", staleCols);

const drift = missingTables.length + missingCols.length + staleTables.length + staleCols.length;
console.log(drift === 0 ? "\nNo drift." : `\n${drift} difference(s). Edit ${CURATED} by hand — do NOT overwrite it.`);
process.exit(drift === 0 ? 0 : 1);
