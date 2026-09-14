import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const BASE = "https://celta-connect.vercel.app";
const picks = JSON.parse(fs.readFileSync(".walk/picks.json","utf8"));

const b = await chromium.launch();
const ctx = await b.newContext({ timezoneId: "Europe/Istanbul", viewport: { width: 1280, height: 1100 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0,130)));
page.on("console", m => { if (m.type()==="error" && !/favicon|_rsc|ERR_ABORTED|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0,130)); });

async function login(email, next) {
  const { data: l } = await db.auth.admin.generateLink({ type:"magiclink", email });
  await page.goto(`${BASE}/auth/confirm?token_hash=${l.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`, { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(4500);
}

const rows = [];
// ---------- CANDIDATE VIEW ----------
for (const p of picks) {
  errs.length = 0;
  await login(p.who.email, `/portfolio/${p.trainee_id}/assignments/${p.id}`);
  const t = await page.evaluate(() => document.body.innerText);
  const iso = /\b20\d\d-\d\d-\d\d\b/.test(t);
  rows.push({
    view: "candidate", type: p.assignment_type, state: `${p.first_status}/${p.resubmission_status}`,
    words: (t.match(/(\d+)\s+of\s+750/) || [])[1] ?? (/Submitted|With your tutor|Opens/.test(t) ? "locked" : "?"),
    appendices: (t.match(/Appendix \d/g) || []).length,
    marks: /Met · round 1|Not met · round 1/.test(t) ? "shown" : "-",
    tutorComment: /Your tutor, on this section/.test(t) ? "yes" : "-",
    isoDate: iso ? "!! ISO" : "-", errors: errs.length,
  });
  await page.screenshot({ path: `.walk/cand-${p.assignment_type.replace(/\W/g,"")}-${p.first_status}.png`, fullPage: false });
}
// ---------- TUTOR VIEW ----------
await login("walk-trainer@celtaconnect.com", "/trainer/assignments");
for (const p of picks) {
  errs.length = 0;
  await page.goto(`${BASE}/trainer/assignments/${p.id}`, { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(3500);
  const t = await page.evaluate(() => document.body.innerText);
  const btn = await page.evaluate(() => { const b=[...document.querySelectorAll('button[type=submit]')].pop(); return b ? b.textContent.trim()+(b.disabled?" (disabled)":"") : "-"; });
  rows.push({
    view: "tutor", type: p.assignment_type, state: `${p.first_status}/${p.resubmission_status}`,
    words: "-", appendices: (t.match(/Appendix \d|Nothing attached/g) || []).length,
    marks: /Not submitted for this round/.test(t) ? "empty panel" : /Marking paused/.test(t) ? "paused" : "doc",
    tutorComment: btn.slice(0,34),
    isoDate: /\b20\d\d-\d\d-\d\d\b/.test(t) ? "!! ISO" : "-", errors: errs.length,
  });
  await page.screenshot({ path: `.walk/tutor-${p.assignment_type.replace(/\W/g,"")}-${p.first_status}.png`, fullPage: false });
}
await b.close();
console.table(rows);
