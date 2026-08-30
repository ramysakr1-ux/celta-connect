// Points Vercel's PRODUCTION environment at the Frankfurt database.
//
// Production only, deliberately: the preview target keeps pointing at the
// Singapore project, so there is a known-good deployment to compare against
// and fall back to while this is being proven.
//
// Rollback is this same script with the old values, or editing the three
// variables in the Vercel dashboard. The Singapore project is never touched
// by any of the migration scripts, so it stays a complete, live copy.
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.migration", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const H = { Authorization: `Bearer ${env.VERCEL_TOKEN}`, "Content-Type": "application/json" };
const PRJ = "prj_W1s4bFOtj3L9KdD8rUvRxiZ12X3y";

// Recorded so a rollback does not depend on anyone remembering what these
// were. Written before anything changes.
const before = await (await fetch(`https://api.vercel.com/v9/projects/${PRJ}/env?decrypt=true`, { headers: H })).json();
const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const snapshot = (before.envs ?? []).filter((e) => keys.includes(e.key) && (e.target ?? []).includes("production"));
fs.writeFileSync(
  "scripts/migration/rollback-values.json",
  JSON.stringify(snapshot.map(({ id, key, value, target }) => ({ id, key, value, target })), null, 2)
);
console.log(`rollback snapshot written for ${snapshot.length} variables`);

const updates = [
  ["NEXT_PUBLIC_SUPABASE_URL", env.NEW_SUPABASE_URL],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", env.NEW_ANON_KEY],
  ["SUPABASE_SERVICE_ROLE_KEY", env.NEW_SERVICE_ROLE_KEY],
];

for (const [key, value] of updates) {
  const row = snapshot.find((e) => e.key === key);
  if (!row) {
    console.log(`${key}: not found on production -- skipped`);
    continue;
  }
  if (!value) {
    console.log(`${key}: no new value in .env.migration -- skipped`);
    continue;
  }
  const r = await fetch(`https://api.vercel.com/v9/projects/${PRJ}/env/${row.id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ value, target: ["production"] }),
  });
  const j = await r.json();
  console.log(`${key}: ${r.ok ? "-> Frankfurt" : `FAILED ${JSON.stringify(j).slice(0, 160)}`}`);
}
