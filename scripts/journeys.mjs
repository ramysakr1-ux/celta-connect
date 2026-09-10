#!/usr/bin/env node
/**
 * The things a person actually does, done in a real browser.
 *
 * The last gap. smoke.mjs proves pages answer; browser-check.mjs proves they
 * do not scream; write-paths.mjs proves the DATABASE accepts a write. None of
 * them run a server action's own code -- the guard clauses, the validation, the
 * revalidate -- because that only happens when a real browser submits a real
 * form. That is roughly a hundred files, and it is where the read-only centre
 * observer once slipped past requireRole("admin").
 *
 * Deliberately few. Journey tests are the brittle kind: they hold selectors,
 * and selectors rot when a button is renamed. So there are three, they are the
 * three a pilot walks, and they are written against ROLES AND TEXT rather than
 * CSS classes, which survive a restyle.
 *
 * The assertion is always the DATABASE, read back with the service role -- not
 * the screen. A page can say "Submitted" without anything having been saved;
 * that is precisely the failure worth catching.
 *
 *   npm run check:journeys
 *   node scripts/journeys.mjs --base https://www.celtaconnect.com --headed
 */

import { chromium } from "playwright";
import { buildWorld, tearDown, magicLinkUrl, env } from "./lib/test-world.mjs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BASE = (arg("base") ?? process.env.SMOKE_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const HEADED = process.argv.includes("--headed");

const E = env();
const { createClient } = await import("@supabase/supabase-js");
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY);

const results = [];
const ok = (name, detail = "") => { results.push({ pass: true, name, detail }); console.log(`  ok    ${name}${detail ? `  (${detail})` : ""}`); };
const bad = (name, why) => { results.push({ pass: false, name, why }); console.log(`  FAIL  ${name}\n          ${why}`); };

let world = null;
let browser = null;

try {
  // Warm the deployment first. The very first request after a deploy pays
  // for a cold serverless function and a cold database connection, and on
  // 11 Sep 2026 that was enough for the assignment form to miss its 15-second
  // wait -- 2 of 3, then 3 of 3 on the re-run, nothing changed in between.
  // A test that fails for reasons that are not bugs is a test that gets
  // ignored, so cold-start is measured out of it rather than into it.
  await fetch(`${BASE}/login`).catch(() => {});
  await fetch(`${BASE}/demo/trainee`, { redirect: "manual" }).catch(() => {});

  world = await buildWorld({ admin });
  browser = await chromium.launch({ headless: !HEADED });

  const signedInPage = async (person, next) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(await magicLinkUrl({ admin, email: person.email, next, baseUrl: BASE }), { waitUntil: "domcontentloaded" });
    return { context, page, errors };
  };

  // ------------------------------------------------- 1. submit an assignment --
  {
    const name = "a trainee writes and submits an assignment";
    const { context, page } = await signedInPage(world.trainee, `/portfolio/${world.trainee.id}/assignments/${world.assignmentId}`);
    try {
      await page.waitForSelector("textarea", { timeout: 30000 });
      const boxes = await page.locator("textarea").all();
      for (const [i, box] of boxes.entries()) {
        await box.fill(`Response ${i + 1}. ${"The learner is a B1 Turkish speaker with strong receptive skills. ".repeat(6)}`);
      }
      // The declaration gates the submit button, so it is part of the journey.
      await page.getByText("I confirm this is my own work.").click();
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await page.waitForTimeout(3500);

      const { data: after } = await admin.from("assignments").select("first_status, first_submitted_at, first_own_work_confirmed").eq("id", world.assignmentId).maybeSingle();
      if (after?.first_status === "submitted" && after?.first_submitted_at) {
        ok(name, `first_status "${after.first_status}", own work ${after.first_own_work_confirmed}`);
      } else {
        bad(name, `the form was filled and submitted, but the row still reads first_status "${after?.first_status}"`);
      }
    } catch (e) {
      bad(name, e.message.split("\n")[0]);
    } finally { await context.close(); }
  }

  // ------------------------------------------------------ 2. write a TP plan --
  {
    const name = "a trainee saves a lesson plan";
    const { context, page } = await signedInPage(world.trainee, `/portfolio/${world.trainee.id}/tp/1`);
    try {
      await page.waitForSelector("textarea", { timeout: 30000 });
      const first = page.locator("textarea").first();
      await first.fill("By the end of the lesson learners will be better able to talk about life experience.");
      const save = page.getByRole("button", { name: /save/i }).first();
      await save.click();
      await page.waitForTimeout(3500);

      const { data: plan } = await admin.from("tp_plans").select("id, main_aims").eq("trainee_id", world.trainee.id).eq("tp_number", 1).maybeSingle();
      plan ? ok(name, `tp_plans row written`) : bad(name, "the form saved but no tp_plans row exists for this trainee");
    } catch (e) {
      bad(name, e.message.split("\n")[0]);
    } finally { await context.close(); }
  }

  // --------------------------------------------- 3. a tutor posts to the course --
  {
    const name = "a tutor posts a notice to the course";
    // /trainer/announcements, not /trainer. The first version of this hunted
    // for "the first textbox on the hub" and clicked the first button that
    // said post/send/share -- which is exactly the vague, position-based
    // selector that makes journey tests rot. The composer has named fields;
    // use them.
    const { context, page } = await signedInPage(world.trainer, `/trainer/announcements`);
    try {
      const before = (await admin.from("course_broadcasts").select("id").eq("course_id", world.courseId)).data?.length ?? 0;
      await page.getByPlaceholder("Title").first().fill("Reading for tomorrow");
      await page.getByPlaceholder(/Write your announcement/).first().fill("Chapter 4 only, not 4 and 5.");
      await page.getByRole("button", { name: "Post announcement" }).click();
      await page.waitForTimeout(3500);
      const after = (await admin.from("course_broadcasts").select("id").eq("course_id", world.courseId)).data?.length ?? 0;
      after > before ? ok(name, `${before} -> ${after} notices`) : bad(name, `posted, but course_broadcasts still holds ${after}`);
    } catch (e) {
      bad(name, e.message.split("\n")[0]);
    } finally { await context.close(); }
  }

} catch (e) {
  bad("harness", e.message);
} finally {
  if (browser) await browser.close();
  await tearDown({ admin, world });
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} of ${results.length} journeys passed.\n`);
process.exit(failed.length > 0 ? 1 : 0);
