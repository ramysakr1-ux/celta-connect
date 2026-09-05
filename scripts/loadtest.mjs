// Load test: sign in as the demo MCT via a one-time link, then hit hub pages
// with N concurrent requests and report latency percentiles. Read-only.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync("/Users/work/CELTA connect-code prompt/.env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; })
);
const SITE = "https://www.celtaconnect.com";
const N = Number(process.argv[2] ?? 20);
const PAGES = (process.argv[3] ?? "/trainer,/trainer/roster,/trainer/timetable").split(",");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: "demo-trainer@celtaconnect.com" });
if (error) throw error;

// Walk the confirm redirect by hand, collecting cookies.
const jar = new Map();
function absorb(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } }
function cookieHeader() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); }
let url = `${SITE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=%2Ftrainer`;
for (let hop = 0; hop < 6; hop++) {
  const res = await fetch(url, { redirect: "manual", headers: { cookie: cookieHeader() } });
  absorb(res);
  const loc = res.headers.get("location");
  if (!loc || res.status < 300 || res.status >= 400) break;
  url = new URL(loc, url).toString();
}
const probe = await fetch(`${SITE}/trainer`, { redirect: "manual", headers: { cookie: cookieHeader() } });
if (probe.status !== 200) { console.error("not signed in:", probe.status, probe.headers.get("location")); process.exit(1); }

async function timed(path) { const t = performance.now(); const r = await fetch(`${SITE}${path}`, { headers: { cookie: cookieHeader() } }); await r.text(); return { ms: Math.round(performance.now() - t), status: r.status }; }
function pct(a, p) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }

for (const path of PAGES) {
  await timed(path); // warm
  const results = await Promise.all(Array.from({ length: N }, () => timed(path)));
  const ms = results.map((r) => r.ms); const bad = results.filter((r) => r.status !== 200).length;
  console.log(`${path.padEnd(20)} x${N} concurrent: p50 ${pct(ms, 0.5)} ms  p90 ${pct(ms, 0.9)} ms  max ${Math.max(...ms)} ms  non-200: ${bad}`);
}
