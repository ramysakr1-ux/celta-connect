// Creates the new Supabase project in Europe via the Management API.
//
// Done here rather than in the dashboard so the database password is
// generated, used and stored without a human ever handling it -- and so the
// region is a recorded decision in the repo rather than a click nobody can
// audit later.
//
//   node scripts/migration/create-project.mjs
//
// Writes NEW_SUPABASE_URL / NEW_SERVICE_ROLE_KEY / NEW_DB_URL back into
// .env.migration for the copy step to pick up.
import fs from "fs";
import crypto from "crypto";

const ENV_FILE = ".env.migration";
const env = Object.fromEntries(
  fs.readFileSync(ENV_FILE, "utf8").split("\n").filter(Boolean).filter((l) => !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.migration");

// Frankfurt: closest EU region to Istanbul, and good for UK users. The whole
// point of the migration is that both hops are short -- the browser's and
// the server's -- so this must be near the users, not near the old project.
const REGION = env.NEW_REGION || "eu-central-1";
const NAME = env.NEW_PROJECT_NAME || "celta-connect-eu";

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.supabase.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

const orgs = await api("/v1/organizations");
if (!orgs?.length) throw new Error("No organisation found for this token.");
const org = orgs[0];
console.log(`organisation: ${org.name} (${org.id})`);

const existing = (await api("/v1/projects")).find((p) => p.name === NAME);
if (existing) {
  console.log(`project already exists: ${existing.id} (${existing.region}) status=${existing.status}`);
  var project = existing;
} else {
  // Generated here, never typed by anyone. Stored only in .env.migration,
  // which is gitignored below.
  const dbPass = crypto.randomBytes(24).toString("base64url");
  console.log(`creating ${NAME} in ${REGION}...`);
  project = await api("/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name: NAME, organization_id: org.id, region: REGION, db_pass: dbPass, plan: "free" }),
  });
  fs.appendFileSync(ENV_FILE, `\nNEW_DB_PASSWORD=${dbPass}\n`);
  console.log(`created: ${project.id}`);
}

// A new project takes a couple of minutes to come up; nothing can be pushed
// to it before it does.
let status = project.status;
for (let i = 0; i < 60 && status !== "ACTIVE_HEALTHY"; i++) {
  await new Promise((r) => setTimeout(r, 10000));
  const p = await api(`/v1/projects/${project.id}`);
  status = p.status;
  process.stdout.write(`\r  status: ${status}   `);
}
console.log();
if (status !== "ACTIVE_HEALTHY") throw new Error(`Project never became healthy (last status: ${status})`);

const keys = await api(`/v1/projects/${project.id}/api-keys`);
const serviceKey = keys.find((k) => k.name === "service_role")?.api_key;
const anonKey = keys.find((k) => k.name === "anon")?.api_key;
if (!serviceKey) throw new Error("Could not read the service_role key.");

const pass = fs.readFileSync(ENV_FILE, "utf8").match(/^NEW_DB_PASSWORD=(.+)$/m)?.[1];
fs.appendFileSync(
  ENV_FILE,
  [
    ``,
    `NEW_PROJECT_REF=${project.id}`,
    `NEW_SUPABASE_URL=https://${project.id}.supabase.co`,
    `NEW_SERVICE_ROLE_KEY=${serviceKey}`,
    `NEW_ANON_KEY=${anonKey}`,
    `NEW_DB_URL=postgresql://postgres.${project.id}:${encodeURIComponent(pass)}@aws-0-${REGION}.pooler.supabase.com:5432/postgres`,
    ``,
  ].join("\n")
);
console.log(`ready: https://${project.id}.supabase.co  (${REGION})`);
console.log("credentials appended to .env.migration");
