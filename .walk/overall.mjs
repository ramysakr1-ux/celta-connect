import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const BASE = "https://celta-connect.vercel.app";
const picks = JSON.parse(fs.readFileSync(".walk/picks.json","utf8"));
const b = await chromium.launch();
const page = await (await b.newContext({ timezoneId:"Europe/Istanbul", viewport:{width:1280,height:1200} })).newPage();
for (const p of picks.filter(x=>["approved","resubmission_required"].includes(x.first_status))) {
  const { data: l } = await db.auth.admin.generateLink({ type:"magiclink", email: p.who.email });
  await page.goto(`${BASE}/auth/confirm?token_hash=${l.properties.hashed_token}&type=magiclink&next=%2Fportfolio%2F${p.trainee_id}%2Fassignments%2F${p.id}`, { waitUntil:"domcontentloaded" });
  await page.waitForTimeout(5500);
  const t = await page.evaluate(()=>document.body.innerText);
  const i = t.search(/YOUR TUTOR, ON THE WHOLE ASSIGNMENT/i);
  console.log(`\n### ${p.who.full_name} · ${p.assignment_type} · ${p.first_status}/${p.resubmission_status}`);
  console.log(i > -1 ? t.slice(i, i+320).replace(/\n+/g,"\n  ") : "  -- overall comment NOT shown --");
  await page.screenshot({ path: `.walk/overall-${p.assignment_type.replace(/\W/g,"")}-${p.first_status}.png` });
}
await b.close();
