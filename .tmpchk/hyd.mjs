import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: l } = await db.auth.admin.generateLink({ type:"magiclink", email:"walk-trainer@celtaconnect.com" });
const b = await chromium.launch();
// Deliberately NOT UTC: the browser is in a real centre's zone, which is the
// whole point -- a server rendering in UTC and a reader in Istanbul.
const ctx = await b.newContext({ timezoneId: "Europe/Istanbul" });
const page = await ctx.newPage();
const out = [];
page.on("console", m => { if (m.type()==="error"||m.type()==="warning") out.push(m.text()); });
page.on("pageerror", e => out.push("PAGEERROR " + String(e)));
await page.goto(`http://localhost:3000/auth/confirm?token_hash=${l.properties.hashed_token}&type=magiclink&next=${encodeURIComponent("/trainer/assignments/766201e6-d002-4f07-a41a-d2a4283ca144")}`, { waitUntil:"domcontentloaded", timeout: 90000 });
await page.waitForTimeout(20000);
for (const o of out) {
  if (/hydrat|did not match|418|423/i.test(o)) console.log("=====\n" + o.slice(0, 2600));
}
if (!out.some(o=>/hydrat/i.test(o))) console.log("no hydration message; all console output:\n", out.join("\n---\n").slice(0,2000));
await b.close();
