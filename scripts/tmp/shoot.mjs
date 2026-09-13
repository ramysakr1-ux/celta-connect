// Screenshots of every assignment, both sides, at each stage.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const BASE = "https://celta-connect.vercel.app";
const OUT = "/tmp/shots";

const { data: co } = await db.from("courses").select("id").eq("name", "CELTA Walkthrough (Ramy)").single();
const { data: people } = await db.from("profiles").select("id, full_name, email").eq("course_id", co.id);
const byName = new Map(people.map((p) => [p.full_name, p]));
const { data: assigns } = await db.from("assignments")
  .select("id, trainee_id, assignment_type, first_status, resubmission_status, resubmission_outcome")
  .eq("course_id", co.id);
const find = (name, type) => {
  const p = byName.get(name);
  const a = assigns.find((x) => x.trainee_id === p.id && x.assignment_type === type);
  return a ? { url: `/portfolio/${p.id}/assignments/${a.id}`, a, p } : null;
};

async function login(browser, email) {
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const ctx = await browser.newContext({ viewport: { width: 1340, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

async function shot(page, url, file, label) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
  console.log(`  ${file}.png   ${label}`);
}

const browser = await chromium.launch();

// ---- trainee side ----
console.log("TRAINEE (Amara Okafor unless noted)");
{
  const { ctx, page } = await login(browser, "walk-amara@celtaconnect.com");
  const amara = byName.get("Amara Okafor");
  await shot(page, `/portfolio/${amara.id}/assignments`, "01-trainee-list", "the four assignments, front page");
  const fol = find("Amara Okafor", "Focus on Learner");
  await shot(page, fol.url, "02-trainee-fol-passed", "Focus on the Learner — passed, closed");
  const sk = find("Amara Okafor", "Skills");
  await shot(page, sk.url, "03-trainee-skills-submitted", "Skills — submitted, with the tutor");
  const lfc = find("Amara Okafor", "LfC");
  await shot(page, lfc.url, "04-trainee-lfc-draft", "Lessons from the Classroom — open, being written");
  await ctx.close();
}
{
  const { ctx, page } = await login(browser, "walk-daniel@celtaconnect.com");
  const r = find("Daniel Kim", "Focus on Learner");
  if (r) await shot(page, r.url, "05-trainee-fol-resubmission", "Focus on the Learner — resubmission needed (Daniel Kim)");
  await ctx.close();
}
{
  const { ctx, page } = await login(browser, "walk-kofi@celtaconnect.com");
  const r = find("Kofi Mensah", "Plagiarism Reflection");
  if (r) await shot(page, r.url, "06-trainee-reflection", "Plagiarism Reflection — the centre sanction (Kofi Mensah)");
  await ctx.close();
}

// ---- trainer side ----
console.log("\nTRAINER (Jordan Blake)");
{
  const { ctx, page } = await login(browser, "walk-trainer@celtaconnect.com");
  await shot(page, "/trainer/assignments", "07-trainer-board", "the marking board");
  const aoife = find("Aoife Byrne", "Skills");
  if (aoife) await shot(page, aoife.url, "08-trainer-round1", "first mark, nothing marked yet");
  const ines = find("Ines Marchetti", "Skills");
  if (ines) await shot(page, ines.url, "09-trainer-with-second-marker", "sent for a blind second mark");
  const leila = find("Leila Haddad", "LRT");
  if (leila) await shot(page, leila.url, "10-trainer-round2", "resubmission in, round 2");
  const closed = find("Ines Marchetti", "Focus on Learner");
  if (closed) await shot(page, closed.url, "11-trainer-closed-fail", "closed — fail on resubmission");
  await ctx.close();
}
{
  const { ctx, page } = await login(browser, "walk-trainer2@celtaconnect.com");
  const ines = find("Ines Marchetti", "Skills");
  if (ines) await shot(page, ines.url, "12-trainer-blind-second-mark", "the blind second marker's own page (Marcus Webb)");
  await ctx.close();
}
await browser.close();
