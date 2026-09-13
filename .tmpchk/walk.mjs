import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const BASE = "https://celta-connect.vercel.app";

const CASES = fs.readFileSync(".tmpchk/cases.txt","utf8").trim().split("\n").map(l=>{
  const [type, who, first, resub, id] = l.split(" :: ");
  return { type, who, first, resub, id };
});

const { data: l } = await db.auth.admin.generateLink({ type:"magiclink", email:"walk-trainer@celtaconnect.com" });
const b = await chromium.launch();
const page = await b.newPage();
const errs = [];
page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0,160)); });
page.on("pageerror", e => errs.push("PAGEERROR " + String(e).slice(0,160)));

await page.goto(`${BASE}/auth/confirm?token_hash=${l.properties.hashed_token}&type=magiclink&next=%2Ftrainer%2Fassignments`);
await page.waitForLoadState("networkidle");

const rows = [];
for (const c of CASES) {
  errs.length = 0;
  const res = await page.goto(`${BASE}/trainer/assignments/${c.id}`, { waitUntil: "networkidle" });
  const t = await page.evaluate(() => document.body.innerText);
  const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent ?? "");
  rows.push({
    type: c.type, state: `${c.first}/${c.resub}`,
    http: res.status(),
    url_ok: page.url().includes(`/trainer/assignments/${c.id}`),
    h1: h1.slice(0, 34),
    hubTabs: t.includes("Roster") && t.includes("Timetable"),
    traineeChrome: /Course stream|My teaching|Catch up/i.test(t),
    previewToggle: /Candidate.s view|preview as/i.test(t),
    body: t.includes("Not yet submitted") ? "empty panel"
        : t.includes("Marking paused") ? "paused"
        : t.toUpperCase().includes("WHAT THEY ATTACHED") ? "marking doc"
        : t.includes("brief hasn't been published") ? "no brief" : "??",
    appendix: /Appendix [12]/.test(t),
    errors: errs.length,
  });
}
await b.close();
console.table(rows);
