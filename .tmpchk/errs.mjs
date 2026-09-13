import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const BASE = "https://celta-connect.vercel.app";
const IDS = {
  "FoL resub/approved": "4abee818-d7a4-4bfb-96d7-1051b6088e3d",
  "LRT approved":       "766201e6-d002-4f07-a41a-d2a4283ca144",
  "LRT resub/approved": "c6a6b8d8-d971-4703-80fb-221b3fb8ece2",
};
const { data: l } = await db.auth.admin.generateLink({ type:"magiclink", email:"walk-trainer@celtaconnect.com" });
const b = await chromium.launch(); const page = await b.newPage();
const errs = [];
page.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
page.on("pageerror", e => errs.push("PAGEERROR " + (e.stack ?? String(e))));
page.on("requestfailed", r => errs.push("REQFAIL " + r.url().slice(0,120) + " " + (r.failure()?.errorText ?? "")));
await page.goto(`${BASE}/auth/confirm?token_hash=${l.properties.hashed_token}&type=magiclink&next=%2Ftrainer%2Fassignments`);
await page.waitForLoadState("networkidle");
for (const [label, id] of Object.entries(IDS)) {
  errs.length = 0;
  await page.goto(`${BASE}/trainer/assignments/${id}`, { waitUntil: "networkidle" });
  console.log("###", label);
  for (const e of errs) console.log("   ", e.slice(0, 400).replace(/\n/g, "\n     "));
  if (!errs.length) console.log("    (none)");
}
await b.close();
