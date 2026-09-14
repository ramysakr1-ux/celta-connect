import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const BASE = "https://celta-connect.vercel.app";
const picks = JSON.parse(fs.readFileSync(".walk/picks.json","utf8"));
const { data: p } = await db.from("profiles").select("id").eq("email","walk-amara@celtaconnect.com").single();
const { data: as } = await db.from("assignments").select("id,assignment_type").eq("trainee_id", p.id);
const fol = as.find(a=>a.assignment_type==="Focus on Learner").id;

const PLAN = {
  "walk-amara@celtaconnect.com": [
    `/portfolio/${p.id}`, `/portfolio/${p.id}/assignments`, `/portfolio/${p.id}/celta5`,
    `/portfolio/${p.id}/progress`, `/portfolio/${p.id}/letters`, `/portfolio/${p.id}/tp`,
    `/portfolio/${p.id}/timetable`, `/portfolio/${p.id}/resources`, `/portfolio/${p.id}/gtky`,
    ...picks.filter(x=>x.trainee_id===p.id).map(x=>`/portfolio/${p.id}/assignments/${x.id}`),
  ],
  "walk-trainer@celtaconnect.com": [
    "/trainer", "/trainer/assignments", `/trainer/assignments/${fol}`, "/trainer/roster",
    "/trainer/timetable", "/trainer/tp", "/trainer/volunteers", "/trainer/grades-report",
    "/trainer/assessor", "/trainer/settings", "/trainer/announcements", "/trainer/coursebooks",
    `/dashboard/trainer/trainees/${p.id}`, `/dashboard/trainer/trainees/${p.id}/celta5`,
  ],
  "ramy@celtaconnect.com": [
    "/centre", "/centre/payments", "/centre/roles", "/centre/courses", "/centre/settings",
    "/dashboard/admissions", "/dashboard/admin",
  ],
};
const b = await chromium.launch();
const page = await (await b.newContext({ timezoneId:"Europe/Istanbul" })).newPage();
const bad = [];
for (const [email, paths] of Object.entries(PLAN)) {
  const { data: l } = await db.auth.admin.generateLink({ type:"magiclink", email });
  await page.goto(`${BASE}/auth/confirm?token_hash=${l.properties.hashed_token}&type=magiclink&next=%2F`, { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(4000);
  for (const path of paths) {
    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 40000 });
      await page.waitForTimeout(2800);
      const n = await page.evaluate(() => {
        const nested = [...document.querySelectorAll("form form")];
        return nested.map(f => {
          const outer = f.closest("form:not(:scope)")?.id || f.parentElement?.closest("form")?.id || "(unnamed)";
          const btn = f.querySelector("button")?.textContent?.trim().slice(0,28) ?? "?";
          return `outer=#${outer} inner-button="${btn}"`;
        });
      });
      if (n.length) { bad.push({ email: email.split("@")[0], path, nested: n.join(" | ") }); console.log("NESTED FORM:", path, n.join(" | ")); }
    } catch (e) { /* skip */ }
  }
}
await b.close();
console.log("\npages with nested forms:", bad.length);
