// Seeds (or resets) the public read-only demo centre -- build-spec.md §1
// build order #21 "Demo -- a flagged clone of the real app." Safe to
// re-run any time: deletes the existing demo centre (if any) and its
// cascading data first, then rebuilds it fresh. Uses the service-role key,
// which connects as `service_role`, not `authenticated` -- the write-
// blocking trigger from migration 0079 only fires for `authenticated`
// sessions, so this script is never blocked by the very protection it's
// setting up.
//
// Extended per connect-multi-role-demo-spec-2026-08-22.md: five entry
// points (centre admin, course admin, volunteer, trainer, trainee) into
// the SAME course, viewed through each role's own lens -- plus a second,
// completed course so centre-admin's history/reporting views aren't
// empty. The three trainees already got real auth.users accounts before
// this change (createUser() below) -- the spec's premise that trainees
// have no login turned out to be stale; the trainee demo just needed a
// route, not new seed data.
//
// Run with: node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);

// toISOString() converts to UTC, which moves the date back a day for any
// centre east of Greenwich -- seeding at local midnight in Istanbul
// (GMT+3) produced dates one day earlier than intended, so a course
// anchored to a Monday came out on the Sunday. Format from the local
// calendar fields instead.
function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

// A CELTA course runs Monday to Friday for four weeks. Anchoring the demo
// course to a Monday matters beyond tidiness: the timetable groups days
// into calendar weeks, so a course that starts on a Friday spans FIVE
// Mondays and renders a Week 5 containing one day. Ramy, 29 Aug 2026:
// "it also reads five weeks at the bottom, and it's the wrong date. So
// it's just the wrong timetable." The board was right; the seed was not.
function mondayNearest(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  // getDay(): 0 Sun .. 6 Sat -- step back to this week's Monday.
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d;
}

// Nth teaching day of the course, 1-based, skipping weekends. Timetable
// events were dated relative to TODAY, which meant they drifted onto
// Saturdays and past the course's own end date depending on when the seed
// ran. A CELTA timetable has 20 teaching days; this puts each event on one
// of them.
function courseDay(start, n) {
  const d = new Date(start);
  let left = n - 1;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() >= 1 && d.getDay() <= 5) left -= 1;
  }
  return isoOf(d);
}

// ------------------------------------------------------------------ clock ---
// WHERE IN ITS LIFE the demo course is planted.
//
// Every screen in Connect computes from "what day of the course is it" -- the
// hero, the rail, the day bar, the assessor pack, close-out. Until this existed
// the seed anchored the course two weeks back and that was the only day any of
// those screens had ever been looked at. So a whole class of bug could only be
// found by waiting for the calendar: on 10 Sep 2026 the trainee's landing was
// found claiming "All your TPs are taught" while the rail sent them off to
// prepare a lesson they had already given, and it had been doing that for days.
//
// Nothing here fakes the clock. The course is MOVED, so the app's own date
// arithmetic runs for real against a real "now" -- which is the only version of
// this test worth having. A frozen clock proves the code agrees with the fake.
//
//   npm run seed:demo -- --stage week1
//   npm run seed:demo -- --stage week4 --unlogged 2
//
// week3 is the default and reproduces exactly what the seed did before.
const STAGE_WEEKS = {
  precourse: 1,   // starts next Monday -- nothing taught, GTKY still open
  week1: 0,       // opened this Monday
  week2: -1,
  week3: -2,      // the historical default
  week4: -3,      // assessor visit week, close-out in sight
  finished: -4,   // ended last Friday
};

function cliArg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}

const STAGE = cliArg("stage") ?? process.env.SEED_STAGE ?? "week3";
if (!(STAGE in STAGE_WEEKS)) {
  console.error(`Unknown --stage "${STAGE}". One of: ${Object.keys(STAGE_WEEKS).join(", ")}`);
  process.exit(1);
}

// How many TP rounds have happened but not been written up yet. taught_at is
// written when the TRAINER logs the outcome, never when the date arrives, so
// this gap is a real state of every real course and needs to be reachable on
// purpose rather than by accident.
const UNLOGGED = Number(cliArg("unlogged") ?? process.env.SEED_UNLOGGED ?? 0);

// Half A teaches on course days 2, 4, 6, 8, 11, 13, 16, 18; half B the day
// after each. Read off the timetable literal further down -- the one schedule,
// not a second opinion about it.
const TP_COURSE_DAYS = {
  1: [2, 4, 6, 8, 11, 13, 16, 18],
  2: [3, 5, 7, 9, 12, 14, 17, 19],
};

async function main() {
  console.log(`stage: ${STAGE}${UNLOGGED ? ` (last ${UNLOGGED} TP round(s) left unlogged)` : ""}`);
  // --- Clean slate ---
  // Every demo centre, not "the" demo centre.
  //
  // This was .maybeSingle(), which returns nothing once a second demo
  // centre exists -- so the whole clean-slate block below was skipped
  // silently, and the run then died trying to create auth users that were
  // already there. A centre owner holding two branches is a supported
  // shape, so the seed has to clear all of them.
  const { data: existingCentres } = await supabase.from("centers").select("id").eq("is_demo", true);
  for (const existing of existingCentres ?? []) {
    const { data: oldProfiles } = await supabase.from("profiles").select("id").eq("center_id", existing.id);
    for (const p of oldProfiles ?? []) {
      const { error: delUserErr } = await supabase.auth.admin.deleteUser(p.id);
      if (delUserErr) console.warn("  couldn't delete auth user", p.id, delUserErr.message);
    }
    // profiles.center_id is `on delete restrict` (deliberately, so a centre
    // can't vanish out from under a live account by accident -- migration
    // 0156's own comment). Deleting each profile's auth.users row above
    // cascades the profile away, but if any single deleteUser() above
    // failed (seen live: transient Auth Admin API errors when deleting
    // several accounts back-to-back), its profile row survives and blocks
    // the centre delete below with a silent no-op -- centers.delete()
    // doesn't surface an FK-restrict violation unless the error is
    // actually checked. Verify nothing is left, and force it if it is,
    // rather than letting that fail invisibly a second time.
    const { data: remaining } = await supabase.from("profiles").select("id").eq("center_id", existing.id);
    for (const p of remaining ?? []) {
      await supabase.auth.admin.deleteUser(p.id).catch(() => {});
    }
    // centre_owner_actions references profiles.id and was added in
    // migration 0193, AFTER centre_hard_delete was written in 0156 -- so
    // the hard-delete function has never known about it, and a centre with
    // any owner action logged against it cannot be deleted. Clear the rows
    // for this centre's own profiles first. (The function itself is fixed
    // in migration 0250; this stays so the seed works against a database
    // that has not run it yet.)
    const { data: toDelete } = await supabase.from("profiles").select("id").eq("center_id", existing.id);
    const ids = (toDelete ?? []).map((p) => p.id);
    if (ids.length > 0) {
      await supabase.from("centre_owner_actions").delete().in("actor_profile_id", ids);
    }
    // Same shape as centre_owner_actions above, and found the same way: the
    // TP library records who wrote each entry, and tp_points.created_by is a
    // plain restrict reference to profiles. Nothing in the demo centre had a
    // library until 10 Sep 2026, so the hard-delete graph had never met it and
    // the next rebuild died on the foreign key. Centre-scoped, so it only ever
    // touches the demo centre being torn down.
    await supabase.from("tp_points").delete().eq("center_id", existing.id);
    await supabase.from("tp_coursebooks").delete().eq("center_id", existing.id);
    await supabase.from("assignment_templates").delete().eq("center_id", existing.id);
    const { error: profileDeleteErr } = await supabase.from("profiles").delete().eq("center_id", existing.id);
    if (profileDeleteErr) console.warn("  profile delete:", profileDeleteErr.message);

    // 0156_centre_hard_delete.sql is the same function the real "Delete
    // this centre" admin flow uses -- reused here rather than a raw
    // `centers.delete()` because it already knows about every FK in the
    // graph that doesn't cascade (restart_transfers/deferral_transfers/
    // course_close_outs), not just the profiles one this script handles
    // above.
    const { error: hardDeleteErr } = await supabase.rpc("centre_hard_delete", { p_center_id: existing.id });
    if (hardDeleteErr) throw hardDeleteErr;
    console.log("Removed previous demo centre:", existing.id);
  }
  // Belt and suspenders: an auth user can outlive its profile row if a
  // previous run failed after createUser() but before the profile insert
  // succeeded (confirmed happening live -- a tutor_role check-constraint
  // mismatch left exactly this orphan). Sweep by email prefix too, not
  // just via the profiles join above.
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  for (const u of allUsers?.users ?? []) {
    if (u.email?.startsWith("demo-") && u.email.endsWith("@celtaconnect.com")) {
      await supabase.auth.admin.deleteUser(u.id).catch(() => {});
    }
  }

  // --- Centre ---
  const { data: center, error: centerErr } = await supabase
    .from("centers")
    .insert({
      // Istanbul, because this is the centre Ramy demos FROM.
      //
      // It was New York, and every clock and date on every screen was
      // therefore seven hours behind him: at 00:26 on Friday the 11th his
      // screens read "Thursday 10 September - 17:26". Correct -- a course runs
      // on its centre's wall clock, and the header labels it -- but nobody
      // walking through a demo should have to hold a timezone conversion in
      // their head to decide whether the product is working. He asked twice.
      //
      // The second branch stays in Los Angeles, so two centres in genuinely
      // different zones still exercise every date helper's explicit-timezone
      // contract. Renaming this one costs nothing: it was always fiction.
      name: "Connect CELTA Istanbul",
      center_number: "DEMO-IST",
      is_demo: true,
      address: "Beyoglu, Istanbul",
      time_zone: "Europe/Istanbul",
    })
    .select("id")
    .single();
  if (centerErr) throw centerErr;
  console.log("centre:", center.id);

  // --- Course: 4 weeks, currently in week 3, reads as a live running course.
  // accepting_applications stays true even mid-course -- nobody has closed
  // intake yet, which is what gives the admissions pipeline / payments demo
  // (below) a live course to attach applicants to. ---
  // Four teaching weeks, Monday to Friday, currently mid-course: start on
  // the Monday a fortnight back, end on the Friday four weeks later. That
  // is 20 teaching days across exactly four calendar weeks, which is what
  // the week picker and "Day N of 20" both assume.
  // Anchored so "today" falls late in week 4 -- around day 15-16 of 20.
  // Late enough that Stage One and Stage Two are released and signed, most
  // TPs graded and three assignments marked, so the demo shows the states
  // a locked, early-course record never can, while the course is still
  // running rather than finished.
  const courseStart = mondayNearest(STAGE_WEEKS[STAGE] * 7);
  const courseEnd = new Date(courseStart);
  courseEnd.setDate(courseStart.getDate() + 25); // Mon + 25 = Friday of week 4
  const startDate = isoOf(courseStart);
  const endDate = isoOf(courseEnd);

  // ---- the course's own calendar, which the seeded RECORD now follows ----
  //
  // Before this, how much teaching had happened was a hardcoded list of
  // days-ago (12, 9, 6, 3, 2, 1) that had nothing to do with when the
  // timetable actually put those lessons. Move the course and the record
  // stayed where it was, so the two disagreed -- which is how the demo ended
  // up with TP7 and TP8 sitting unrecorded days after their dates had passed,
  // and the landing page contradicting itself about them.
  //
  // A lesson is taught on the day the timetable says it is taught. Everything
  // below derives from that, so the record is coherent at ANY stage.
  const todayIso = isoOf(new Date());
  const tpDateIso = (half, tpNumber) => courseDay(courseStart, TP_COURSE_DAYS[half][tpNumber - 1]);
  /** TP rounds this half has already been through -- strictly before today, so
   *  a lesson happening this morning is not yet in the book. */
  const tpRoundsSoFar = (half) => {
    let n = 0;
    for (let i = 1; i <= 8; i += 1) if (tpDateIso(half, i) < todayIso) n = i;
    return n;
  };
  /** ...minus whatever --unlogged asks us to leave open. */
  const tpRoundsLogged = (half) => Math.max(0, tpRoundsSoFar(half) - UNLOGGED);

  // Hours taught so far, for attendance. The same elapsed-teaching-days idea
  // src/lib/course-progress.ts uses, kept in step with it deliberately.
  const weekdaysBetween = (from, to) => {
    if (to < from) return 0;
    let n = 0;
    const d = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    while (d <= end) { const w = d.getDay(); if (w >= 1 && w <= 5) n += 1; d.setDate(d.getDate() + 1); }
    return n;
  };
  const COURSE_TOTAL_HOURS = 120;
  const elapsed = (() => {
    const total = weekdaysBetween(startDate, endDate);
    if (total <= 0) return 1;
    return Math.min(1, weekdaysBetween(startDate, todayIso < endDate ? todayIso : endDate) / total);
  })();
  const hoursSoFar = Math.max(1, Math.round(COURSE_TOTAL_HOURS * elapsed));

  // The CELTA "kind of lesson" (src/lib/aim-type.ts): grammar/lexis/function
  // are language-systems aims, the four skills are receptive/productive split
  // by mode. plan_assignments.aim_type drives the "Main aims so far" coverage
  // matrix on the Rotation screen -- the thing that keeps each candidate's six
  // lessons varied and fair. It was null on every seeded plan, so that matrix
  // rendered blank and the whole fairness mechanism was invisible in the demo.
  // Classified from the aim text, the same way a tutor would tag it.
  const aimTypeOf = (aim) => {
    const a = (aim || "").toLowerCase();
    if (/\bwriting\b|write a|writing task/.test(a)) return "writing";
    if (/\bspeaking\b|discussion|role.?play|giving opinions|telling a story|conversation/.test(a)) return "speaking";
    if (/\breading\b|read for|reading for/.test(a)) return "reading";
    if (/\blisten|listening/.test(a)) return "listening";
    if (/vocabulary|lexis|collocation|word|phrases|describing/.test(a)) return "lexis";
    if (/function|suggestion|advice|apologi|arrangement|invit|request|complain|offer/.test(a)) return "function";
    if (/grammar|tense|present |past |future |conditional|perfect|continuous|used to|comparative|quantifier|modal|article/.test(a)) return "grammar";
    return "grammar";
  };
  // Everyone at or near a full record except two. Kofi is the borderline case
  // an MCT would want to see; Daniel (below) is the real problem.
  const ATTENDANCE_RATE = { "Kofi Mensah": 0.70 };
  console.log(`attendance: ${hoursSoFar} of ${COURSE_TOTAL_HOURS} h taught so far`);
  console.log(
    `course: ${startDate} -> ${endDate}; half A has been through ${tpRoundsSoFar(1)} TP round(s), half B ${tpRoundsSoFar(2)}`
  );
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .insert({
      center_id: center.id,
      name: "CELTA Demo Course",
      start_date: startDate,
      end_date: endDate,
      total_hours: 120,
      delivery_mode: "f2f",
      accepting_applications: true,
      // Monday of week 4 -- a half-1 TP day (start+21, TP7), which is where
      // the Handbook puts the visit: the last week, on a day with teaching
      // practice to observe. Without this the assessor pack's "On the day"
      // panel reads "No assessor visit date set yet" and the new
      // /assessor/lesson-plans page has no day to draw plans from, so the
      // whole visit half of the pack demos as empty.
      assessor_visit_date: isoOf(new Date(courseStart.getTime() + 21 * 86400000)),
    })
    .select("id")
    .single();
  if (courseErr) throw courseErr;
  console.log("course:", course.id);

  // --- Trainer (main course tutor) ---
  const { data: trainerAuth, error: trainerAuthErr } = await supabase.auth.admin.createUser({
    email: "demo-trainer@celtaconnect.com",
    email_confirm: true,
  });
  if (trainerAuthErr) throw trainerAuthErr;
  const trainerId = trainerAuth.user.id;
  const { error: trainerProfileErr } = await supabase.from("profiles").insert({
    id: trainerId,
    email: "demo-trainer@celtaconnect.com",
    full_name: "Jordan Blake",
    role: "trainer",
    tutor_role: "main_course_tutor",
    center_id: center.id,
    course_id: course.id,
  });
  if (trainerProfileErr) throw trainerProfileErr;
  await supabase.from("course_tutors").insert({
    course_id: course.id,
    profile_id: trainerId,
    tutor_role: "main_course_tutor",
    verified_at: new Date().toISOString(),
  });
  console.log("trainer:", trainerId);

  // --- Second trainer, staffing realism (Centre Admin spec: "more than one
  // trainer on the roster, not just the single seeded trainer used by the
  // trainer demo"). profiles_course_required_for_trainer_trainee means a
  // trainer row can't have a null course_id, so this person is a genuine
  // assistant tutor on the same shared course rather than left unassigned. ---
  const { data: trainer2Auth, error: trainer2AuthErr } = await supabase.auth.admin.createUser({
    email: "demo-trainer2@celtaconnect.com",
    email_confirm: true,
  });
  if (trainer2AuthErr) throw trainer2AuthErr;
  const trainer2Id = trainer2Auth.user.id;
  await supabase.from("profiles").insert({
    id: trainer2Id,
    email: "demo-trainer2@celtaconnect.com",
    full_name: "Marcus Webb",
    role: "trainer",
    tutor_role: "assistant_course_tutor",
    center_id: center.id,
    course_id: course.id,
  });
  await supabase.from("course_tutors").insert({
    course_id: course.id,
    profile_id: trainer2Id,
    tutor_role: "assistant_course_tutor",
    verified_at: new Date().toISOString(),
  });
  console.log("second trainer:", trainer2Id);

  // --- Centre admin (centre owner) and Course admin demo accounts.
  // Genuinely distinct roles (src/lib/auth/centre-permissions.ts's
  // CENTRE_ROLES/landingFor -- "never merge these two builds"), not the
  // same admin role at different scope, so each gets its own seeded
  // account rather than collapsing into one. Both are `role: "admin"` on
  // profiles (course_id may be null for admins), with the real permission
  // living in centre_roles. ---
  const { data: centreAdminAuth, error: centreAdminAuthErr } = await supabase.auth.admin.createUser({
    email: "demo-centre-admin@celtaconnect.com",
    email_confirm: true,
  });
  if (centreAdminAuthErr) throw centreAdminAuthErr;
  const centreAdminId = centreAdminAuth.user.id;
  await supabase.from("profiles").insert({
    id: centreAdminId,
    email: "demo-centre-admin@celtaconnect.com",
    full_name: "Diane Okonkwo",
    role: "admin",
    center_id: center.id,
  });
  await supabase.from("centre_roles").insert({
    profile_id: centreAdminId,
    center_id: center.id,
    role: "centre_owner",
  });
  console.log("centre admin:", centreAdminId);

  // The other two centre roles, so the Roles tab is not two-thirds empty.
  //
  // Careful with the keys: the built-in role KEYS are legacy and do not
  // match their on-screen LABELS. role-strip.tsx renders
  // `centre_administrator` under the heading "Centre manager" (runs
  // admissions, payments and course setup), and `centre_manager` under
  // "Centre observer" (read-only). A third value, `centre_observer`, is
  // accepted by the column but has no entry in that map at all, so anyone
  // granted it renders nowhere. Granting what the labels say rather than
  // what the keys say puts people under the wrong heading, or loses them.
  //
  // The Roles page argues "that is two roles, not one shared login" and
  // then showed "Nobody yet" against both of them, which rather undercut
  // the point.
  for (const person of [
    { email: "demo-centre-manager@celtaconnect.com", name: "Priya Raman", role: "centre_administrator" },
    { email: "demo-centre-observer@celtaconnect.com", name: "Alan Whitfield", role: "centre_manager" },
  ]) {
    const { data: auth, error: authErr } = await supabase.auth.admin.createUser({
      email: person.email,
      email_confirm: true,
    });
    if (authErr) throw authErr;
    await supabase.from("profiles").insert({
      id: auth.user.id,
      email: person.email,
      full_name: person.name,
      role: "admin",
      center_id: center.id,
    });
    await supabase.from("centre_roles").insert({
      profile_id: auth.user.id,
      center_id: center.id,
      role: person.role,
    });
  }
  console.log("centre roles: manager and observer granted");

  // --- A pipeline that looks like a centre actually recruiting ---
  //
  // Ramy, 2 Sep 2026, looking at the demo he was about to show: "it just seems
  // like they're not doing very well. Zero money collected... very few
  // admissions. They could have made things look a little better." He was
  // right -- New York had three applicants, Los Angeles none at all, so every
  // money figure read zero and switching branches went from three rows to an
  // empty page.
  //
  // Run separately by scripts/seed-demo-pipeline.mjs so it can also be applied
  // to an existing demo centre without a full rebuild.
  // (Actually run further down, once BOTH branches exist -- see below.)


  // A SECOND branch, in another city, owned by the same person.
  //
  // Multi-centre was already built -- /centre aggregates across every centre
  // you hold a role at, courses carry their branch, and the ?branch filter
  // can only narrow, never widen. It had simply never been demonstrated,
  // because the owner held a role at exactly one centre. Ramy, 30 Aug 2026:
  // "can we design this so the centre owner owns two centres in two
  // different cities?"
  //
  // Note this makes TWO rows with is_demo = true. Anything reaching for
  // "the" demo centre with .maybeSingle() breaks the moment this exists --
  // which is exactly what happened to mint-magic-link.ts, the volunteer and
  // assessor demo routes, and this script's own teardown. All four fixed;
  // the pattern is the bug, not any one of them.
  const { data: branchTwo } = await supabase
    .from("centers")
    .insert({
      name: "Connect CELTA Los Angeles",
      center_number: "DEMO-LA",
      is_demo: true,
      address: "Silver Lake, Los Angeles, CA",
      time_zone: "America/Los_Angeles",
    })
    .select("id")
    .single();
  await supabase.from("centre_roles").insert({
    profile_id: centreAdminId,
    center_id: branchTwo.id,
    role: "centre_owner",
  });
  // An upcoming course, so the Overview reads "1 running, 1 upcoming,
  // 1 closed" across the branches rather than everything being in the past.
  await supabase.from("courses").insert({
    center_id: branchTwo.id,
    name: "CELTA Los Angeles — Autumn",
    start_date: isoDaysFromNow(14),
    end_date: isoDaysFromNow(42),
    total_hours: 120,
    delivery_mode: "f2f",
    accepting_applications: true,
  });
  // Staff at the second branch.
  //
  // Ramy, 31 Aug 2026: Los Angeles had a course and nobody at all -- so
  // switching branches on a screen built to show a two-city owner landed on
  // an empty centre. A branch with no people is not a second branch, it is a
  // row in the centres table.
  //
  // Deliberately NOT a copy of New York's roster: the point of two branches
  // is that they differ. LA gets its own manager and its own course
  // administrator, and no observer -- a smaller branch that has not split
  // the read-only role out yet, which is a truer picture than symmetry.
  for (const person of [
    { email: "demo-la-manager@celtaconnect.com", name: "Rosa Delgado", role: "centre_administrator" },
    { email: "demo-la-course-admin@celtaconnect.com", name: "Kenji Watanabe", role: "course_administrator" },
  ]) {
    const { data: auth, error: authErr } = await supabase.auth.admin.createUser({
      email: person.email,
      email_confirm: true,
    });
    if (authErr) throw authErr;
    await supabase.from("profiles").insert({
      id: auth.user.id,
      email: person.email,
      full_name: person.name,
      role: "admin",
      center_id: branchTwo.id,
    });
    await supabase.from("centre_roles").insert({
      profile_id: auth.user.id,
      center_id: branchTwo.id,
      role: person.role,
    });
  }

  console.log("second branch: Los Angeles, owned by the same person, with its own staff");

  // --- Admissions pipeline for BOTH demo branches ---
  //
  // Runs HERE, not where it used to sit further up, because it fills both
  // branches and Los Angeles did not exist yet at that point -- it died on
  // `la.id` of undefined every single time.
  //
  // The child also gets the credentials EXPLICITLY. This file reads .env.local by
  // hand into `url`/`key` rather than loading it into process.env, so passing
  // `env: process.env` handed the child nothing and it died on
  // "supabaseUrl is required" -- caught, warned about in a line nobody read,
  // and the run carried on looking successful. So the pipeline this seeds has
  // never once been in the demo, on any rebuild, since the day it was written:
  // exactly the empty funnel Ramy asked to have fixed. Found 10 Sep 2026 while
  // building the stage harness, which is the point of the harness.
  await import("node:child_process").then(({ execFileSync }) => {
    try {
      execFileSync("node", ["scripts/seed-demo-pipeline.mjs"], {
        stdio: "inherit",
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: url,
          SUPABASE_SERVICE_ROLE_KEY: key,
          // By id, not by name. See the pipeline's own comment.
          DEMO_PRIMARY_CENTER_ID: center.id,
          DEMO_SECOND_CENTER_ID: branchTwo?.id ?? "",
        },
      });
    } catch (e) {
      // Loudly. A seed step that fails quietly is a seed step that is not there.
      console.error("  PIPELINE SEED FAILED:", e.message);
      process.exitCode = 1;
    }
  });

  // The assessor, linked BOTH ways -- because there are two of them.
  //
  // courses.assessor_name/assessor_email is free text, and drives the
  // assessor pack, the Grade form and the visit page. Assessor History
  // reads something else entirely: course_tutors rows with
  // tutor_role = 'external_assessor', joined to a real profile. Setting
  // one leaves the other empty, which is why that screen said "no assessor
  // has been linked to a course at this centre yet" while every other
  // screen named one.
  //
  // Linked to both demo courses on purpose: two consecutive courses puts
  // the centre exactly at Handbook 13.3's limit, so the screen shows its
  // own warning rather than an empty table.
  const { data: assessorAuth, error: assessorAuthErr } = await supabase.auth.admin.createUser({
    email: "demo-assessor@celtaconnect.com",
    email_confirm: true,
  });
  if (assessorAuthErr) throw assessorAuthErr;
  // profiles_course_required_for_trainer_trainee: a trainer profile must
  // carry a course, so this takes the running one.
  await supabase.from("profiles").insert({
    id: assessorAuth.user.id,
    email: "demo-assessor@celtaconnect.com",
    full_name: "Dr Helen Marsh",
    role: "trainer",
    center_id: center.id,
    course_id: course.id,
  });
  await supabase.from("course_tutors").insert({
    course_id: course.id,
    profile_id: assessorAuth.user.id,
    tutor_role: "external_assessor",
  });
  const demoAssessorId = assessorAuth.user.id;
  await supabase
    .from("courses")
    .update({
      assessor_name: "Dr Helen Marsh",
      assessor_email: "demo-assessor@celtaconnect.com",
      appian_notification_reference: "CELTA-2026-08-4471",
    })
    .eq("id", course.id);
  console.log("assessor: linked on courses.assessor_name AND course_tutors");

  const { data: courseAdminAuth, error: courseAdminAuthErr } = await supabase.auth.admin.createUser({
    email: "demo-course-admin@celtaconnect.com",
    email_confirm: true,
  });
  if (courseAdminAuthErr) throw courseAdminAuthErr;
  const courseAdminId = courseAdminAuth.user.id;
  await supabase.from("profiles").insert({
    id: courseAdminId,
    email: "demo-course-admin@celtaconnect.com",
    full_name: "Tom Ridley",
    role: "admin",
    center_id: center.id,
  });
  const { data: courseAdminRole } = await supabase
    .from("centre_roles")
    .insert({
      profile_id: courseAdminId,
      center_id: center.id,
      role: "course_administrator",
    })
    .select("id")
    .single();
  await supabase.from("course_administrator_scope").insert({
    centre_role_id: courseAdminRole.id,
    course_id: course.id,
  });
  // migration 0103's own comment says the permission layer requires both
  // the scope row above AND a course_tutors row carrying verified_at (the
  // Cambridge-approval evidence) -- centre-permissions.ts notes that
  // second half was never actually enforced in code, but seeding it
  // anyway matches the documented intent and keeps this account correct
  // if a "who's approved on this course" screen ever reads course_tutors
  // directly. tutor_role stays null: approved, but not on the teaching
  // roster (Ramy's "could be the same person... but it could also not be").
  await supabase.from("course_tutors").insert({
    course_id: course.id,
    profile_id: courseAdminId,
    verified_at: new Date().toISOString(),
  });
  console.log("course admin:", courseAdminId);

  // --- Trainees, varied depth ---
  // Twelve candidates, six and six (Ramy, 6 Sep 2026). Two TP groups, each
  // split into halves of three that teach on alternating days -- the shape
  // this timetable was always written for ("All six meet the learners", slots
  // A-F) but which only ever had three people in it.
  //
  // Three candidates could not demonstrate anything that involves a range:
  // no half B meant the rotation never rotated, and the assessor's own
  // recommendation had nothing to choose between. The grade spread below is
  // Ramy's own worked example -- two in danger of failing, one Pass A, the
  // rest passing -- plus one withdrawal, so every section of the candidate
  // wall has something real in it.
  //
  // `grade`/`upper` are the provisional pair: upper set makes it a range, so
  // Fail + Pass reads "Fail / Pass" (a potential Fail). Left null for the one
  // candidate the grading meeting has not settled.
  const traineeDefs = [
    { name: "Amara Okafor", email: "demo-amara@celtaconnect.com", group: "A", half: 1, slot: 0, grade: "Pass B", upper: null },
    { name: "Daniel Kim", email: "demo-daniel@celtaconnect.com", group: "A", half: 1, slot: 1, grade: "Fail", upper: "Pass" },
    { name: "Priya Sharma", email: "demo-priya@celtaconnect.com", group: "A", half: 1, slot: 2, grade: "Pass A", upper: null },
    { name: "Tomas Novak", email: "demo-tomas@celtaconnect.com", group: "A", half: 2, slot: 0, grade: "Pass", upper: null },
    { name: "Leila Haddad", email: "demo-leila@celtaconnect.com", group: "A", half: 2, slot: 1, grade: "Pass B", upper: null },
    { name: "Sam Whitfield", email: "demo-sam@celtaconnect.com", group: "A", half: 2, slot: 2, grade: "Pass", upper: null },
    { name: "Ines Marchetti", email: "demo-ines@celtaconnect.com", group: "B", half: 1, slot: 0, grade: "Fail", upper: "Pass" },
    { name: "Kofi Mensah", email: "demo-kofi@celtaconnect.com", group: "B", half: 1, slot: 1, grade: "Pass B", upper: null },
    { name: "Hana Sato", email: "demo-hana@celtaconnect.com", group: "B", half: 1, slot: 2, grade: "Pass", upper: null },
    { name: "Ruben Ortiz", email: "demo-ruben@celtaconnect.com", group: "B", half: 2, slot: 0, grade: null, upper: null },
    { name: "Aoife Byrne", email: "demo-aoife@celtaconnect.com", group: "B", half: 2, slot: 1, grade: "Pass B", upper: null },
    // Withdrew mid-course. Handbook 14.2 makes the withdrawal letter and the
    // application the assessor's business, so the demo needs one.
    { name: "Marek Kowalski", email: "demo-marek@celtaconnect.com", group: "B", half: 2, slot: 2, grade: null, upper: null, withdrawn: true },
  ];

  // Which half a candidate teaches in decides which days their TPs fall on,
  // and so how many of their rounds have already happened by now.
  const halfOf = (name) => traineeDefs.find((d) => d.name === name).half;
  const trainees = {};
  // The centre's sample for the assessor visit. CELTA 5: assessors "scrutinise
  // a selection of portfolios to moderate candidates' work" -- a selection, not
  // the cohort. Migration 0284 made the column default false so a centre opts
  // people in; the demo picks four so the pack actually demonstrates the
  // narrowing instead of listing everybody (Ramy, 10 Sep 2026: "why is the
  // assessor getting all those cards?").
  const assessorSampleCount = 4;
  let assessorSampleTaken = 0;
  for (const def of traineeDefs) {
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: def.email,
      email_confirm: true,
    });
    if (authErr) throw authErr;
    const { error: traineeProfileErr } = await supabase.from("profiles").insert({
      id: authUser.user.id,
      email: def.email,
      full_name: def.name,
      role: "trainee",
      center_id: center.id,
      course_id: course.id,
      course_status: def.withdrawn ? "withdrawn" : "active",
      course_status_set_at: def.withdrawn ? new Date(Date.now() - 9 * 86400000).toISOString() : null,
      // Withdrawn candidates are not part of a moderation sample.
      selected_for_assessor_visit: !def.withdrawn && assessorSampleTaken < assessorSampleCount ? (assessorSampleTaken += 1, true) : false,
    });
    if (traineeProfileErr) throw traineeProfileErr;
    trainees[def.name] = authUser.user.id;
  }
  console.log("trainees:", trainees);

  // --- Getting to know you: each trainee is offered three activities ---
  //
  // Without a gtky_assignments row the GTKY page calls notFound(), so
  // /demo/trainee-gtky returned a 404 for everyone -- found 2 Sep 2026 while
  // walking the demo journeys, with zero rows in the table centre-wide. The
  // activities themselves live in code (src/lib/gtky-activities.ts), so only
  // the offer needs seeding. Different trios per trainee, because the real
  // assigner avoids giving one TP group the same activity twice.
  const GTKY_OFFERS = [
    ["ball_game", "find_someone_who", "line_up_according_to"],
    ["find_your_other_half", "draw_your_name", "ball_game"],
    ["line_up_according_to", "find_your_other_half", "find_someone_who"],
  ];
  await supabase.from("gtky_assignments").insert(
    Object.values(trainees).map((traineeId, i) => ({
      center_id: center.id,
      course_id: course.id,
      trainee_id: traineeId,
      level_band: "inter",
      offered_slugs: GTKY_OFFERS[i % GTKY_OFFERS.length],
    }))
  );
  console.log("gtky assignments: offered to", Object.keys(trainees).length, "trainees");

  // --- TP subgroup, which is what actually switches the chat on ---
  //
  // Ramy, 29 Aug 2026: "I don't see those options where you can have TP
  // group or DM with tutor." The demo centre had no subgroups at all, and a
  // trainee's TP-group chat channel only exists once they're IN a subgroup
  // -- the trigger in migration 0041 provisions the channel off
  // course_subgroup_members, nothing else does. So every demo trainee's
  // chat pill opened on nothing. (The matching code bug, which also took
  // away DM-your-tutor, is fixed in src/lib/staff-chat.ts.)
  //
  // Three candidates, so this is ONE half of a TP group rather than a group
  // split in two -- half_order is what the rotation reads (today-tab.tsx
  // bails to "your teaching schedule isn't set up yet" without it, and
  // halfTpDates in src/lib/rotation.ts gives half 1 alternating TP dates,
  // which is exactly the TP1 A/B/C then D/E/F shape the demo timetable
  // below already has). A plain subgroup would switch the chat on and
  // leave the teaching card contradicting it.
  // Two TP groups of six, each split into halves of three. half_order is what
  // the rotation reads (halfTpDates in src/lib/rotation.ts gives half 1 the
  // alternating TP dates), and until 6 Sep 2026 the demo had only half 1 with
  // three people in it -- so the alternation the whole rotation is built on
  // was never exercised by anything we verified against.
  const tpGroupIds = {};
  for (const [name, tutorId] of [["Group A", trainer2Id], ["Group B", trainerId]]) {
    const { data: g, error: gErr } = await supabase
      .from("course_tp_groups")
      // The ACT (Marcus Webb) keeps Group A -- what makes the ACT demo show a
      // group of their own rather than the whole course, and lets them post a
      // group-scoped announcement (5 Sep 2026). The MCT takes Group B.
      .insert({ course_id: course.id, name, tutor_profile_id: tutorId })
      .select("id")
      .single();
    if (gErr) throw gErr;
    tpGroupIds[name] = g.id;
    // The tutor plan (migration 0268) is what the Rotation card shows; the
    // field above is derived from it on real courses, so the demo gets the
    // matching "from TP1" row rather than a field with no plan behind it.
    const { error: planErr } = await supabase.from("course_tp_group_tutors").insert({
      course_id: course.id,
      tp_group_id: g.id,
      tutor_profile_id: tutorId,
      from_tp_number: 1,
      note: "Seeded demo plan",
    });
    if (planErr) throw planErr;
  }

  const subgroupIds = {};
  for (const letter of ["A", "B"]) {
    for (const half of [1, 2]) {
      const { data: sg, error: sgErr } = await supabase
        .from("course_subgroups")
        .insert({
          course_id: course.id,
          name: `Group ${letter} -- Day ${half === 1 ? "A" : "B"}`,
          tp_group_id: tpGroupIds[`Group ${letter}`],
          half_order: half,
        })
        .select("id")
        .single();
      if (sgErr) throw sgErr;
      subgroupIds[`${letter}${half}`] = sg.id;
    }
  }
  // base_slot is the rotation position (0-indexed, unique within the
  // subgroup, migration 0014) -- who teaches first, second, third, rotating
  // one place each TP. It's NOT NULL, so seeding members without it fails.
  const { error: subgroupMemberErr } = await supabase.from("course_subgroup_members").insert(
    traineeDefs.map((def) => ({
      subgroup_id: subgroupIds[`${def.group}${def.half}`],
      trainee_id: trainees[def.name],
      base_slot: def.slot,
    }))
  );
  if (subgroupMemberErr) throw subgroupMemberErr;
  const tpGroup = { id: tpGroupIds["Group A"] };
  console.log("subgroups:", Object.keys(subgroupIds).length, "-- TP group chat channels provisioned by trigger");

  // --- The TP library, and the assignment briefs ---
  //
  // Both were missing entirely, and the smoke test found them by being unable
  // to open a single page that needed one (10 Sep 2026): the demo centre had
  // ZERO tp_coursebooks and ZERO assignment_templates of its own. Elmswood has
  // both, which is why nobody noticed -- unscoped queries kept finding the real
  // centre's and the demo's own screens were simply never opened.
  //
  // Three things were broken by that, not one:
  //
  //   1. /trainer/coursebooks/[id] and /trainer/assignment-briefs/[id] had
  //      never been opened by anyone, on any course.
  //   2. The TP library the whole plan-assignment flow reads from was empty.
  //   3. CELTA 5's Section 6 could not show LEVELS. computeAssessedTpStats
  //      traces a taught TP to its level through plan_assignments.tp_point_id
  //      -> tp_points -> tp_coursebooks.level, and nothing seeded that link, so
  //      "at least two levels" (Handbook, six assessed hours at two levels) read
  //      as zero levels for every demo candidate. tp_lessons.level was being
  //      seeded with the right words and is not the column that page reads.
  //
  // Two coursebooks, split at TP5 -- the timetable's own "Level & tutor change"
  // -- so the demo genuinely demonstrates the two-level requirement rather than
  // asserting it. tp_coursebooks.level is a bare CEFR code, not the wrapped
  // display string.
  // The TP Points Library, and the per-group coursebook schedule, built so the
  // demo runs the REAL rotation engine (assign_tp_round, migration 0288)
  // instead of hand-writing plans. Two books -- A2 (below intermediate) and
  // B1+ -- each covering TP1-6 with THREE distinct published points per round,
  // because a day-set is three trainees and the engine hands each of them a
  // different point (§9.1.2: a round is three different lessons). Aim types are
  // derived the same way a tutor tags them (aimTypeOf), so the coverage matrix
  // is populated for free.
  const AIMS_BY_LEVEL = {
    "A2": {
      1: ["Grammar: present simple for daily routines", "Reading for gist: three short profiles", "Vocabulary: everyday objects"],
      2: ["Listening for gist: a day in the life", "Grammar: there is / there are", "Functional language: ordering in a cafe"],
      3: ["Vocabulary: food and drink", "Reading for detail: a simple menu", "Grammar: countable and uncountable nouns"],
      4: ["Grammar: past simple (regular verbs)", "Speaking: talking about last weekend", "Listening for detail: a short anecdote"],
      5: ["Functional language: making arrangements", "Vocabulary: places in a town", "Reading for gist: a short city guide"],
      6: ["Grammar: comparative adjectives", "Speaking: describing people", "Vocabulary: adjectives of personality"],
    },
    "B1+": {
      1: ["Grammar: present perfect for experience", "Reading for gist and detail: a city-life article", "Vocabulary: travel and transport"],
      2: ["Listening for detail: a radio interview", "Grammar: past continuous", "Functional language: making suggestions"],
      3: ["Vocabulary: air travel", "Reading for detail: a short review", "Grammar: the second conditional"],
      4: ["Grammar: used to for past habits", "Speaking: giving and justifying opinions", "Listening for gist: a podcast extract"],
      5: ["Functional language: apologising", "Vocabulary: work and study", "Reading for gist: a workplace article"],
      6: ["Grammar: defining relative clauses", "Speaking: telling a story", "Vocabulary: describing character"],
    },
  };
  const BOOKS = [
    { level: "A2", title: "Roadmap A2 (Set 1)", filename: "Roadmap_A2_Set1.zip" },
    { level: "B1+", title: "Speakout 3rd Edition B1+ (Set 1)", filename: "Speakout_B1plus_Set1.zip" },
  ];
  const coursebookIdByLevel = {};
  let pointCount = 0;
  for (const book of BOOKS) {
    const { data: cb, error: cbErr } = await supabase
      .from("tp_coursebooks")
      .insert({
        center_id: center.id,
        title: book.title,
        level: book.level,
        storage_path: `demo:${book.filename}`,
        original_filename: book.filename,
        uploaded_by: trainerId,
        generation_status: "completed",
      })
      .select("id")
      .single();
    if (cbErr) throw cbErr;
    coursebookIdByLevel[book.level] = cb.id;
    for (let tp = 1; tp <= 6; tp += 1) {
      // Rotate the round's three aims by (tp-1) before lettering their
      // sequence_index. The engine gives base-slot b the point at offset
      // (b + tp-1) mod 3, so without this a fixed trainee lands on the same
      // sequence position's TYPE every round -- base-slot 0 taught grammar all
      // three A2 rounds. The offset de-correlates aim type from rotation
      // position, so each trainee cycles through the round's three kinds.
      const roundAims = AIMS_BY_LEVEL[book.level][tp];
      const rotated = roundAims.map((_, i) => roundAims[(i + (tp - 1)) % roundAims.length]);
      for (const [seq, aim] of rotated.entries()) {
        const { error: ptErr } = await supabase.from("tp_points").insert({
          tp_coursebook_id: cb.id,
          center_id: center.id,
          tp_number: tp,
          sequence_index: seq,
          density_tier: tp <= 2 ? "scripted" : tp <= 4 ? "framework" : "minimal",
          main_lesson_aim: aim,
          aim_type: aimTypeOf(aim),
          sub_aim: "You choose -- and say in your plan why it follows from the main aim.",
          materials_description: `${book.title} -- see the TP Points Library`,
          generation_source: "manual",
          status: "published",
          created_by: trainerId,
        });
        if (ptErr) throw ptErr;
        pointCount += 1;
      }
    }
  }
  console.log("TP library:", BOOKS.length, "coursebooks,", pointCount, "points (3 per round)");

  // Per-group schedule: Group A teaches A2 then B1+, Group B the mirror, so the
  // two groups are at two levels in parallel and swap at TP4 -- every candidate
  // teaches both (§9.1.2). This is the row assign_tp_round reads to know which
  // book feeds a group's round.
  const SCHEDULE = {
    "Group A": { 1: "A2", 2: "A2", 3: "A2", 4: "B1+", 5: "B1+", 6: "B1+" },
    "Group B": { 1: "B1+", 2: "B1+", 3: "B1+", 4: "A2", 5: "A2", 6: "A2" },
  };
  for (const [groupName, byTp] of Object.entries(SCHEDULE)) {
    for (const [tp, level] of Object.entries(byTp)) {
      const { error } = await supabase.from("course_tp_schedule").insert({
        course_id: course.id,
        tp_group_id: tpGroupIds[groupName],
        tp_number: Number(tp),
        tp_coursebook_id: coursebookIdByLevel[level],
      });
      if (error) throw error;
    }
  }
  console.log("TP schedule: 2 groups x 6 rounds, two levels in parallel");

  // Run the REAL engine. assign_tp_round distributes a distinct library point
  // to each trainee in a subgroup by rotation position, for every round -- the
  // exact code a live course runs. seedTaughtTp below then only MARKS rounds
  // taught and writes the feedback; the aims themselves come from here.
  for (const sgId of Object.values(subgroupIds)) {
    for (let tp = 1; tp <= 6; tp += 1) {
      const { error } = await supabase.rpc("assign_tp_round", { p_subgroup_id: sgId, p_tp_number: tp });
      if (error) throw new Error(`assign_tp_round(${sgId}, TP${tp}): ${error.message}`);
    }
  }
  console.log("assign_tp_round: plans created for TP1-6 across every subgroup");

  // The four Cambridge assignments, as briefs with real section prompts. The
  // sections are what the brief page actually renders -- storage_path is only
  // the uploaded original, and "system:" is the established marker for a brief
  // that has no file behind it (malpractice/actions.ts writes the same for the
  // plagiarism reflection).
  const BRIEFS = [
    {
      type: "Focus on Learner",
      sections: [
        { key: "learner_profile", title: "Learner profile", instruction: "Describe your chosen learner or small group: age, nationality, first language, reason for studying English, and how they prefer to learn." },
        { key: "needs_analysis", title: "Needs analysis", instruction: "What evidence did you gather, and how? Refer to the pooled observation log, not only your impressions." },
        { key: "language_problem", title: "The language problem", instruction: "Claim one specific grammar or pronunciation problem. Analyse meaning, form and phonology, and say why it matters for this learner." },
        { key: "remedial", title: "Remedial activities", instruction: "Two activities, with a rationale for each and a reference to the source you took or adapted them from." },
      ],
    },
    {
      type: "LRT",
      sections: [
        { key: "meaning", title: "Meaning", instruction: "For each item: concept, a concept-checking question, and the answer you would expect." },
        { key: "form", title: "Form", instruction: "Write the form out. Include contractions, negatives and questions where they apply." },
        { key: "phonology", title: "Phonology", instruction: "Sentence stress, weak forms and connected speech features, with a model marked up." },
        { key: "problems", title: "Anticipated problems and solutions", instruction: "One problem per item, with the clarification approach you would use." },
      ],
    },
    {
      type: "Skills",
      sections: [
        { key: "text", title: "The text", instruction: "Attach your authentic text and say where it came from. Do not simplify it." },
        { key: "suitability", title: "Suitability", instruction: "Why this text for this level and this group? Comment on length, topic, and lexical load." },
        { key: "receptive", title: "Receptive tasks", instruction: "A gist task and a detail task, with the rationale for each." },
        { key: "productive", title: "Productive task", instruction: "One task that follows from the text, with a rationale linking it to the receptive work." },
      ],
    },
    {
      type: "LfC",
      sections: [
        { key: "strengths", title: "Strengths", instruction: "Two strengths, each evidenced from a specific lesson and from tutor or peer feedback." },
        { key: "development", title: "Areas for development", instruction: "Two areas, evidenced the same way. Be specific: 'instructions' is not an area, 'staging instructions for a jigsaw reading' is." },
        { key: "action_plan", title: "Action plan", instruction: "What you will do next, how you will know it worked, and by when." },
      ],
    },
  ];
  for (const brief of BRIEFS) {
    const { error: brErr } = await supabase.from("assignment_templates").insert({
      center_id: center.id,
      assignment_type: brief.type,
      storage_path: `system:${brief.type.toLowerCase().replace(/\s+/g, "-")}`,
      sections: brief.sections,
      generation_status: "completed",
      published_at: new Date().toISOString(),
    });
    if (brErr) throw brErr;
  }
  console.log("assignment briefs:", BRIEFS.length);

  // --- TP feedback helper -- returns the tp_plans.id so callers can attach
  // shared materials to a specific plan. ---
  // Criteria the seeded feedback wording actually evidences. Planning codes
  // are what the PLAN showed; teaching codes are what the LESSON showed.
  const PLANNING_CODES = {
    "Clear instructions": ["4e"],                       // procedure described in sufficient detail
    "Good rapport with learners": ["1a"],               // aware of the needs and interests of the group
    "Effective concept checking": ["4i", "4j"],         // language analysed; difficulties anticipated
    "Vary interaction patterns a little more": ["4f"],  // interaction patterns appropriate to the activity
  };
  const TEACHING_CODES = {
    "Clear instructions": ["5f"],                       // instructions made clear to learners
    "Good rapport with learners": ["1d"],               // rapport, learners fully involved
    "Effective concept checking": ["5g", "2e"],         // questions for checking; meaning and form clarified
    "Vary interaction patterns a little more": ["5b"],  // setting up and managing group activities
  };

  // `half` replaces the old `daysAgo`: the lesson happened when the timetable
  // says it happened, and the plan, self-evaluation, feedback and CELTA 5 row
  // all hang off that one date instead of six invented ones.
  // Marks a round taught and writes its records. The PLAN already exists --
  // assign_tp_round created it from the library above -- so this reads the
  // engine's aim rather than inventing one, updates taught_at, and derives the
  // real level from the point's coursebook. Returns the plan id, or null if
  // the trainee has no plan for that round (withdrawn / not assigned).
  async function seedTaughtTp(traineeId, tpNumber, { grade, strengths, actionPoints, half }) {
    const lessonIso = tpDateIso(half, tpNumber);
    const lessonMs = Date.parse(`${lessonIso}T12:00:00Z`);
    const at = (offsetDays = 0) => new Date(lessonMs + offsetDays * 86400000).toISOString();
    let { data: assigned } = await supabase
      .from("plan_assignments")
      .select("id, main_lesson_aim, tp_point_id")
      .eq("trainee_id", traineeId)
      .eq("tp_number", tpNumber)
      .maybeSingle();
    // TP7 and TP8 are self-select -- outside the library, so assign_tp_round
    // never created them. On a stage late enough to have taught them, create
    // the self-chosen plan here (a real trainee picks it via the syllabus
    // grid) before marking it taught.
    if (!assigned) {
      if (tpNumber < 7) return null;
      const selfAim = tpNumber === 7 ? "Giving advice -- should and ought to" : "Reading for gist -- city guides";
      const { data: created, error: selfErr } = await supabase
        .from("plan_assignments")
        .insert({
          course_id: course.id,
          trainee_id: traineeId,
          tp_number: tpNumber,
          main_lesson_aim: selfAim,
          aim_type: aimTypeOf(selfAim),
          density_tier: "coaching_prose",
          class_grouping: "whole_class",
          assigned_by: trainerId,
        })
        .select("id, main_lesson_aim, tp_point_id")
        .single();
      if (selfErr) throw selfErr;
      assigned = created;
    }
    const aim = assigned.main_lesson_aim;
    // The level that was actually taught, traced through the assigned point.
    let level = "Elementary (A2)";
    if (assigned.tp_point_id) {
      const { data: pt } = await supabase.from("tp_points").select("tp_coursebook_id").eq("id", assigned.tp_point_id).maybeSingle();
      const { data: cbk } = pt ? await supabase.from("tp_coursebooks").select("level").eq("id", pt.tp_coursebook_id).maybeSingle() : { data: null };
      if (cbk?.level) level = cbk.level === "A2" ? "Elementary (A2)" : `Lower-intermediate (${cbk.level})`;
    }
    await supabase.from("plan_assignments").update({ taught_at: at() }).eq("id", assigned.id);
    const { data: plan } = await supabase
      .from("tp_plans")
      .insert({
        course_id: course.id,
        trainee_id: traineeId,
        tp_number: tpNumber,
        main_aims: aim,
        submitted_at: at(-1),
      })
      .select("id")
      .single();
    await supabase.from("tp_self_evaluations").insert({
      tp_plan_id: plan.id,
      trainee_id: traineeId,
      tp_number: tpNumber,
      what_went_well: "The lead-in got strong engagement and the timing worked well.",
      what_not_as_planned: "Ran short on freer practice time.",
      submitted_at: at(),
    });
    await supabase.from("tp_feedback").insert({
      tp_plan_id: plan.id,
      trainee_id: traineeId,
      tp_number: tpNumber,
      trainer_id: trainerId,
      grade,
      // Every point carried criteria_codes: [] until 2 Sep 2026, so the
      // "Criteria evidenced" panel on a candidate's TP page said "No criteria
      // tagged in this lesson's feedback" on every lesson, for every
      // candidate -- the panel exists precisely to show that tagging, and it
      // was demonstrating the opposite. The codes below are the real ones the
      // wording points at, and the same point is coded differently under
      // planning and teaching because that is the distinction CELTA 5 draws:
      // 4x is what the plan shows, 5x is what the lesson shows.
      strengths_planning: strengths.map((s) => ({ text: s, starred: false, criteria_codes: PLANNING_CODES[s] ?? [] })),
      action_points_planning: actionPoints.map((s) => ({ text: s, starred: false, criteria_codes: PLANNING_CODES[s] ?? [] })),
      strengths_teaching: strengths.map((s) => ({ text: s, starred: false, criteria_codes: TEACHING_CODES[s] ?? [] })),
      action_points_teaching: actionPoints.map((s) => ({ text: s, starred: false, criteria_codes: TEACHING_CODES[s] ?? [] })),
      overall_comment: "A confident, well-paced lesson overall -- keep building on this.",
      submitted_at: at(),
    });

    // The CELTA 5 "Record of assessed teaching practice" reads tp_lessons,
    // which nothing seeded -- so that page of the booklet said "No assessed
    // teaching practice recorded yet" for every candidate, including one with
    // eight graded lessons behind her. Found 2 Sep 2026 sweeping the demo for
    // empty panels after the criteria one turned up by luck.
    //
    // Written from the same facts as the feedback above rather than invented:
    // the form is a record of what happened, so it must agree with it. The
    // level changes at TP5, matching the timetable's "Level & tutor change".
    await supabase.from("tp_lessons").insert({
      course_id: course.id,
      trainee_id: traineeId,
      trainer_id: trainerId,
      tp_number: tpNumber,
      lesson_date: lessonIso,
      length_minutes: 45,
      level,
      learner_count: level.startsWith("Elementary") ? 9 : 11,
      lesson_focus: aim,
      tutor_assessment: grade,
    });
    return plan.id;
  }

  // Two candidates carry a recurring action point on purpose -- that is what
  // "at risk" is for, and an MCT needs to see it working. Everyone else gets a
  // different point each round, which is what good feedback looks like.
  const AT_RISK_CANDIDATES = new Set(["Hana Sato", "Marek Kowalski"]);
  const ROTATING_ACTION_POINTS = [
    "Vary interaction patterns a little more",
    "Give clearer time limits on tasks",
    "Grade your language a little further for this level",
    "Check instructions with a question, not \"OK?\"",
    "Board the form as well as the meaning",
    "Leave more thinking time after a question",
    "Monitor further from the pair you are helping",
    "Nominate rather than take the first hand up",
  ];

  // Amara: strong, 4 TPs taught
  const amaraTpPlanIds = []; // index 0 = TP1, ... -- every TP gets several
  // shared materials below, not one apiece (Ramy, 25 Aug 2026, pointing at
  // Volunteer View.dc.html's own "3 handouts"/"2 handouts" rows: "I'm
  // talking about the actual materials where they lie inside the cards").
  // Real file per handout name, not a fake placeholder link -- Ramy, 25 Aug
  // 2026, after the pills/counts were already right: "the actual material
  // that they received, the handouts. Where are they? ... Where the fuck
  // are they?" A "3 handouts" pill that opens a dead demo-placeholder Google
  // Slides link isn't a handout, it's a lie about one. These are real,
  // on-topic one-page PDFs checked into scripts/seed-assets/tp-materials/.
  const HANDOUT_ASSET = {
    "Present perfect -- slides": "present-perfect-slides.pdf",
    "Present perfect -- gap-fill handout": "present-perfect-gap-fill.pdf",
    "Reading for gist and detail -- handout": "reading-city-life-text.pdf",
    "Reading for gist -- comprehension questions": "reading-comprehension-questions.pdf",
    "Air Travel vocabulary -- flashcards": "air-travel-vocabulary-flashcards.pdf",
    "Air Travel -- listening transcript": "air-travel-listening-transcript.pdf",
    "Air Travel -- matching worksheet": "air-travel-matching-worksheet.pdf",
    "Making suggestions -- worksheet": "making-suggestions-worksheet.pdf",
    "Making suggestions -- role-play cards": "making-suggestions-role-play-cards.pdf",
  };
  for (const [i, cfg] of [
    { aim: "Present perfect for life experience", grade: "above_standard", materialNames: ["Present perfect -- slides", "Present perfect -- gap-fill handout"] },
    { aim: "Reading for gist and detail: a city life article", grade: "to_standard", materialNames: ["Reading for gist and detail -- handout", "Reading for gist -- comprehension questions"] },
    { aim: "Vocabulary: Air Travel", grade: "above_standard", materialNames: ["Air Travel vocabulary -- flashcards", "Air Travel -- listening transcript", "Air Travel -- matching worksheet"] },
    { aim: "Functional language: Making suggestions", grade: "to_standard", materialNames: ["Making suggestions -- worksheet", "Making suggestions -- role-play cards"] },
    // Ramy, 30 Aug 2026: "provisional grades are submitted around the end of
    // TP6, so it doesn't make sense that we have one and two TPs in there --
    // there should be at least six." The demo had candidates carrying a
    // provisional grade after one or two TPs, which is not a state a real
    // course is ever in.
    { aim: "Receptive skills: listening for specific information", grade: "above_standard", materialNames: [] },
    { aim: "Grammar: second conditional in context", grade: "above_standard", materialNames: [] },
    // TP7 and TP8 -- the same two lessons the "still to come" block further
    // down assigns her. Which of the two blocks actually gets them is decided
    // by the calendar: taught if their day has been, still to come if not.
    { aim: "Giving advice -- should and ought to", grade: "to_standard", materialNames: [] },
    { aim: "Reading for gist -- city guides", grade: "above_standard", materialNames: [] },
  ]
    .slice(0, tpRoundsLogged(halfOf("Amara Okafor")))
    .entries()) {
    const planId = await seedTaughtTp(trainees["Amara Okafor"], i + 1, {
      aim: cfg.aim,
      grade: cfg.grade,
      strengths: ["Clear instructions", "Good rapport with learners", "Effective concept checking"],
      actionPoints: [ROTATING_ACTION_POINTS[i % ROTATING_ACTION_POINTS.length]],
      half: halfOf("Amara Okafor"),
    });
    amaraTpPlanIds.push({ planId, materialNames: cfg.materialNames });
  }

  // The nine candidates added on 6 Sep 2026 get a plain six taught TPs each,
  // so the roster, the wall and the assessor's recommendation all read TP 6/8
  // for them rather than TP 0/8. Deliberately unembellished -- the three
  // original candidates keep the hand-written detail (shared materials, a
  // self-evaluation, an open Stage Three) that the walkthroughs depend on,
  // and nine more of that would be noise rather than a better demo.
  const FILLER_AIMS = [
    "Present simple for routines",
    "Reading for gist: short news items",
    "Vocabulary: food and cooking",
    "Functional language: making arrangements",
    "Listening for specific information",
    "Past continuous for interrupted actions",
  ];
  for (const def of traineeDefs.slice(3)) {
    // A candidate who withdrew stops teaching at the point they left.
    // As many rounds as have actually happened -- a candidate who withdrew
    // stops at the point they left, whichever comes first.
    const taught = Math.min(def.withdrawn ? 3 : 8, tpRoundsLogged(def.half));
    for (let n = 1; n <= taught; n += 1) {
      await seedTaughtTp(trainees[def.name], n, {
        aim: FILLER_AIMS[(n - 1) % FILLER_AIMS.length],
        grade: n % 3 === 0 ? "above_standard" : "to_standard",
        strengths: ["Clear instructions", "Good rapport with learners"],
        // A DIFFERENT action point each round, except for the two candidates
        // who are meant to look at risk.
        //
        // computeAtRiskReasons raises "repeating action point" when the same
        // criterion comes back across two or more TPs -- which is a real CELTA
        // warning sign, and the detector is right. The fixture gave every
        // candidate the identical action point on every single TP, so ten of
        // twelve were flagged at risk and the MCT's landing page read as a
        // course in collapse. A demo should show a course being run well, with
        // the couple of genuine concerns an MCT would actually be chasing.
        actionPoints: [AT_RISK_CANDIDATES.has(def.name)
          ? "Vary interaction patterns a little more"
          : ROTATING_ACTION_POINTS[(n - 1) % ROTATING_ACTION_POINTS.length]],
        half: def.half,
      });
    }
  }
  console.log("taught TPs seeded for", traineeDefs.length, "candidates");
  // EVERY candidate gets a CELTA 5 record, not just the one with a
  // provisional grade. In the real app it is created the moment they join
  // (join/[token]/actions.ts) -- the seed writes profiles directly, so it
  // has to do the same thing that path does.
  //
  // Found 31 Aug 2026 in the pre-demo sweep: only Amara had one, so opening
  // any other candidate's workspace showed "No CELTA 5 record exists for
  // this trainee yet... an admin will need to add it manually", and their
  // Progress tab said "check CELTA 5" -- pointing at the thing that did not
  // exist. Grades now come from traineeDefs (see below), since the course
  // sits past its own provisional deadline.
  // Provisional grades come from traineeDefs. Ramy, 30 Aug 2026: they are
  // submitted around the end of TP6, and this demo course sits at TP6/8 with
  // its provisional deadline already past -- so a graded cohort is the honest
  // state, not an empty one. The one candidate left ungraded is the one the
  // grading meeting has not settled, which is also a real state.
  await supabase.from("celta5_records").insert(
    traineeDefs.map((def) => ({
      course_id: course.id,
      trainee_id: trainees[def.name],
      // Hours are measured against the hours that have HAPPENED (see
      // courseElapsedFraction), so a flat 24 out of a 120-hour course read as
      // 20% for everyone and put the entire cohort on the MCT's landing page
      // under "Attendance below 80%". Ramy, 10 Sep 2026: "it's all red, it's
      // like the end of the world."
      //
      // A well-run course is the default. Two candidates carry a real
      // attendance problem, because a demo with nothing wrong in it teaches
      // nobody what the alert looks like.
      hours_attended: def.withdrawn ? Math.round(hoursSoFar * 0.4) : Math.round(hoursSoFar * (ATTENDANCE_RATE[def.name] ?? 1)),
      provisional_grade: def.grade,
      provisional_grade_upper: def.upper,
    }))
  );
  await supabase.from("assignments").insert([
    {
      course_id: course.id,
      trainee_id: trainees["Amara Okafor"],
      assignment_type: "Focus on Learner",
      first_status: "approved",
      first_content_grade: "pass",
      first_english_grade: "pass",
      first_submitted_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      marker_id: trainerId,
      final_grade: "Pass", // capital P: reads compare against "Pass" exactly
    },
    {
      course_id: course.id,
      trainee_id: trainees["Amara Okafor"],
      assignment_type: "LRT",
      first_status: "approved",
      first_content_grade: "pass",
      first_english_grade: "pass",
      first_submitted_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      marker_id: trainerId,
      final_grade: "Pass", // capital P: reads compare against "Pass" exactly
    },
  ]);

  // Daniel: average, 2 TPs, one resubmission in progress, a recurring action point (at-risk)
  for (const [i, cfg] of [
    { aim: "Grammar: First conditional", grade: "to_standard" },
    { aim: "Listening for gist: a podcast about moving abroad", grade: "not_to_standard" },
    { aim: "Vocabulary: describing character", grade: "to_standard" },
    { aim: "Reading for detail: a workplace article", grade: "to_standard" },
    { aim: "Functional language: making arrangements", grade: "to_standard" },
    { aim: "Grammar: past continuous for interrupted actions", grade: "to_standard" },
    { aim: "Vocabulary: work and study habits", grade: "to_standard" },
    { aim: "Reading for gist: short reviews", grade: "to_standard" },
  ]
    .slice(0, tpRoundsLogged(halfOf("Daniel Kim")))
    .entries()) {
    await seedTaughtTp(trainees["Daniel Kim"], i + 1, {
      aim: cfg.aim,
      grade: cfg.grade,
      strengths: ["Good board work"],
      actionPoints: ["Instructions need to be more concise and checked", "Monitor more actively during pair work"],
      half: halfOf("Daniel Kim"),
    });
  }
  await supabase.from("celta5_records").insert({
    course_id: course.id,
    trainee_id: trainees["Daniel Kim"],
    hours_attended: Math.round(hoursSoFar * 0.72), // Daniel -- the genuine attendance concern
  });
  await supabase.from("assignments").insert({
    course_id: course.id,
    trainee_id: trainees["Daniel Kim"],
    assignment_type: "Focus on Learner",
    first_status: "resubmission_required",
    first_content_grade: "fail",
    first_english_grade: "pass",
    first_submitted_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    marker_id: trainerId,
    due_date: isoDaysFromNow(-2),
  });
  // Open concern -- gives the trainer/course layer a live "needs you" item,
  // deliberately kept off the centre-admin account (spec: centre admin's
  // state should read healthy, this tension belongs one layer down).
  await supabase.from("concerns").insert({
    course_id: course.id,
    trainee_id: trainees["Daniel Kim"],
    route: "tutor",
    body: "I'm finding the pace hard to keep up with after the resubmission -- could we find some extra time to go through concept-checking together before TP5?",
    anonymous: false,
  });

  // Priya: six TPs like the others, but the weakest profile of the three --
  // a provisional grade only makes sense once the TP cycle is nearly done.
  for (const [i, cfg] of [
    { aim: "Reading for gist and detail: a workplace article", grade: "to_standard" },
    { aim: "Vocabulary: food and cooking", grade: "not_to_standard" },
    { aim: "Grammar: comparatives", grade: "to_standard" },
    { aim: "Speaking: giving opinions", grade: "to_standard" },
    { aim: "Listening for gist: a radio interview", grade: "not_to_standard" },
    { aim: "Functional language: apologising", grade: "to_standard" },
    { aim: "Speaking: telling a story", grade: "to_standard" },
    { aim: "Grammar: used to for past habits", grade: "to_standard" },
  ]
    .slice(0, tpRoundsLogged(halfOf("Priya Sharma")))
    .entries()) {
    await seedTaughtTp(trainees["Priya Sharma"], i + 1, {
      aim: cfg.aim,
      grade: cfg.grade,
      strengths: ["Warm, confident classroom presence"],
      actionPoints: ["Give clearer time limits on tasks"],
      half: halfOf("Priya Sharma"),
    });
  }
  await supabase.from("celta5_records").insert({
    course_id: course.id,
    trainee_id: trainees["Priya Sharma"],
    hours_attended: Math.round(hoursSoFar * 0.95), // Priya
  });

  // --- Criteria ratings, so the Grades Report has something to derive ---
  //
  // Without these the four criteria lists on the Grades Report read "None"
  // for every candidate, because they are computed from celta5_matrix: S+
  // becomes a strength, N an action point, section 4 is planning and the
  // rest teaching. The seed never wrote a single rating, so the most
  // substantial screen we have demoed as empty.
  //
  // Shaped to each candidate's story rather than sprinkled: Amara is the
  // strong one four TPs in, Daniel has a not-to-standard TP2 and a failed
  // assignment, Priya has taught once and has barely been rated yet. Plain
  // "S" ratings are included deliberately -- they are the ones the report
  // omits by design ("all criteria not listed below is assumed to be to
  // standard"), so their absence from the lists is itself worth seeing.
  const matrixByCandidate = {
    "Amara Okafor": {
      "4a": "S+", "4e": "S+", "4i": "S+", "4j": "S", "4g": "N",
      "2c": "S+", "2e": "S+", "5b": "S", "5i": "S+", "5f": "N", "1d": "S+",
    },
    "Daniel Kim": {
      "4a": "S", "4b": "N", "4e": "S", "4i": "N",
      "2a": "N", "2c": "S", "5f": "N", "5k": "N", "1d": "S+",
    },
    "Priya Sharma": {
      "4a": "S", "4c": "S+",
      "1d": "S+", "5j": "S",
    },
  };
  for (const [name, ratings] of Object.entries(matrixByCandidate)) {
    const rows = Object.entries(ratings).map(([criteria_code, tutor_status_stage2]) => ({
      course_id: course.id,
      trainee_id: trainees[name],
      criteria_code,
      tutor_status_stage2,
    }));
    const { error } = await supabase.from("celta5_matrix").insert(rows);
    if (error) throw error;
  }

  // --- Plans for the assessor's visit day ---
  //
  // TP7 is what half 1 teaches on assessor_visit_date (start+21), so these
  // are the plans the assessor reads before observing -- the pack's
  // "Lesson plans for the day" row (/assessor/lesson-plans). Submitted but
  // not taught: the visit is still ahead of "today" in this seed, which is
  // the state that row exists to show. seedTaughtTp is deliberately not
  // reused -- it also writes a taught_at, a self-evaluation and tutor
  // feedback, none of which can exist for a lesson nobody has taught yet.
  const visitPlans = [
    {
      name: "Amara Okafor",
      main: "Functional language: agreeing and disagreeing politely in a meeting",
      sub: "Fluency practice in a role-played team discussion",
      profile: "Twelve B1+ adults, mixed L1, used to working in pairs. Three are quiet in open class.",
      materials: "Adapted audio from the coursebook unit 8, plus a role card set of my own",
      framework: "Test-teach-test",
    },
    {
      name: "Daniel Kim",
      main: "Reading for detail: a short news article on remote work",
      sub: "Pre-teaching four items of topic vocabulary",
      profile: "Same B1+ group. Strong readers, but they tend to read every word rather than skim.",
      materials: "Article with a graded gist task and a detail task I wrote",
      framework: "Receptive skills lesson",
    },
    {
      name: "Priya Sharma",
      main: "Grammar: used to for past habits",
      sub: "Controlled written practice before freer speaking",
      profile: "Same B1+ group. They have met the past simple but not used to.",
      materials: "Guided discovery handout built from the coursebook text",
      framework: "Guided discovery into controlled practice",
    },
  ];
  for (const vp of visitPlans) {
    await supabase.from("tp_plans").insert({
      course_id: course.id,
      trainee_id: trainees[vp.name],
      tp_number: 7,
      main_aims: vp.main,
      subsidiary_aims: vp.sub,
      class_profile: vp.profile,
      materials_description: vp.materials,
      framework_used: vp.framework,
      submitted_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    });
  }

  // --- Pre-course task: seeded per-centre (centre admins normally author
  // these themselves), then marked handed in for all three trainees so the
  // shared course reads as properly mid-stream, not day one. ---
  const { data: pctSections } = await supabase
    .from("pre_course_task_sections")
    .insert([
      {
        center_id: center.id,
        source: "cambridge",
        sequence_index: 1,
        title: "Your language learning experience",
        prompt: "Describe a language you have learned (other than your first) and what helped or hindered you.",
      },
      {
        center_id: center.id,
        source: "cambridge",
        sequence_index: 2,
        title: "Observing a lesson",
        prompt: "What do you expect to be the biggest challenge in managing a class of adult learners?",
      },
      {
        center_id: center.id,
        source: "centre_supplement",
        sequence_index: 3,
        title: "Getting to know you",
        prompt: "Tell us a little about your background and what brought you to CELTA.",
      },
    ])
    .select("id");
  for (const traineeId of Object.values(trainees)) {
    for (const section of pctSections ?? []) {
      await supabase.from("pre_course_task_responses").insert({
        course_id: course.id,
        trainee_id: traineeId,
        section_id: section.id,
        response: "Completed before the course start date.",
        submitted_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      });
    }
  }

  // ---------------------------------------------------------------------
  // The real four-week timetable, ported from Ramy's own design file
  // ("Timetable View (standalone)") rather than invented: 179 sessions
  // across 20 teaching days and nine time bands. d = teaching day 1-20,
  // b = band index into BAND_TIMES below.
  //
  // Replaces the twelve scattered events this seed used to create, which
  // were dated relative to the day the seed ran and so drifted onto
  // weekends and past the course's own end date.
  // ---------------------------------------------------------------------
  const BAND_TIMES = ["10:00", "10:45", "11:45", "12:45", "13:30", "14:15", "15:15", "16:15", "17:15"];

  const designSessionsBase = [
    { d: 1, b: 1, type: "input_session", title: "Course introduction", tag: "whole_group", detail: "Timetable, CELTA 5, portfolio", linked: null, tp: null, shares: true },
    { d: 1, b: 2, type: "supervised_session", title: "Demo lesson", tag: "group_room", detail: "Observation task", linked: null, tp: null, shares: true },
    { d: 1, b: 3, type: "supervised_session", title: "Demo lesson", tag: "group_room", detail: "Observation task", linked: null, tp: null, shares: true },
    { d: 1, b: 4, type: "supervised_session", title: "Unassessed teach", tag: "group_room", detail: "All six meet the learners", linked: null, tp: null, shares: true },
    { d: 1, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 1, b: 6, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised", linked: null, tp: null },
    { d: 1, b: 7, type: "input_session", title: "Classroom management", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 1, b: 8, type: "input_session", title: "Classroom management / Zoom", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 1, b: 9, type: "input_session", title: "Focus on the Learner", tag: "whole_group", detail: "The assignment session", linked: null, tp: null },
    { d: 2, b: 1, type: "tp", title: "TP1 \u00b7 A", tag: "group_room", detail: null, linked: null, tp: 1 },
    { d: 2, b: 2, type: "tp", title: "TP1 \u00b7 B", tag: "group_room", detail: null, linked: null, tp: 1 },
    { d: 2, b: 3, type: "tp", title: "TP1 \u00b7 C", tag: "group_room", detail: null, linked: null, tp: 1 },
    { d: 2, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised", linked: null, tp: null },
    { d: 2, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 2, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 2, b: 7, type: "input_session", title: "Lesson planning input", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 2, b: 8, type: "input_session", title: "Receptive skills", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 2, b: 9, type: "assignment_due", title: "Assignment 3 Q&A", tag: null, detail: "Released the evening before", linked: null, tp: null },
    { d: 3, b: 1, type: "tp", title: "TP1 \u00b7 D", tag: "group_room", detail: null, linked: null, tp: 1 },
    { d: 3, b: 2, type: "tp", title: "TP1 \u00b7 E", tag: "group_room", detail: null, linked: null, tp: 1 },
    { d: 3, b: 3, type: "tp", title: "TP1 \u00b7 F", tag: "group_room", detail: null, linked: null, tp: 1 },
    { d: 3, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised", linked: null, tp: null },
    { d: 3, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 3, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 3, b: 7, type: "input_session", title: "Eliciting and concept checking", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 3, b: 8, type: "input_session", title: "Teaching vocabulary", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 3, b: 9, type: "assignment_due", title: "Assignment 2 (LRT) Q&A", tag: null, detail: "Released the evening before", linked: "LRT", tp: null },
    { d: 4, b: 1, type: "tp", title: "TP2 \u00b7 A", tag: "group_room", detail: null, linked: null, tp: 2 },
    { d: 4, b: 2, type: "tp", title: "TP2 \u00b7 B", tag: "group_room", detail: null, linked: null, tp: 2 },
    { d: 4, b: 3, type: "tp", title: "TP2 \u00b7 C", tag: "group_room", detail: null, linked: null, tp: 2 },
    { d: 4, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised", linked: null, tp: null },
    { d: 4, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 4, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 4, b: 7, type: "input_session", title: "PPP", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 4, b: 8, type: "input_session", title: "Text-based teaching", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 4, b: 9, type: "milestone", title: "Consultation", tag: "consultation", detail: "Bookable", linked: null, tp: null },
    { d: 5, b: 1, type: "tp", title: "TP2 \u00b7 D", tag: "group_room", detail: null, linked: null, tp: 2 },
    { d: 5, b: 2, type: "tp", title: "TP2 \u00b7 E", tag: "group_room", detail: null, linked: null, tp: 2 },
    { d: 5, b: 3, type: "tp", title: "TP2 \u00b7 F", tag: "group_room", detail: null, linked: null, tp: 2 },
    { d: 5, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised", linked: null, tp: null },
    { d: 5, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 5, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 5, b: 7, type: "input_session", title: "Sounds", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 5, b: 8, type: "input_session", title: "Language analysis", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 5, b: 9, type: "input_session", title: "Filmed observation 1", tag: "whole_group", detail: "With task", linked: null, tp: null },
    { d: 6, b: 1, type: "tp", title: "TP3 \u00b7 A", tag: "group_room", detail: null, linked: null, tp: 3 },
    { d: 6, b: 2, type: "tp", title: "TP3 \u00b7 B", tag: "group_room", detail: null, linked: null, tp: 3 },
    { d: 6, b: 3, type: "tp", title: "TP3 \u00b7 C", tag: "group_room", detail: null, linked: null, tp: 3 },
    { d: 6, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised \u00b7 DEF", linked: null, tp: null },
    { d: 6, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 6, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 6, b: 7, type: "input_session", title: "Connected speech", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 6, b: 8, type: "input_session", title: "Stress and intonation", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 6, b: 9, type: "milestone", title: "Consultation", tag: "consultation", detail: "Bookable", linked: null, tp: null },
    { d: 7, b: 1, type: "tp", title: "TP3 \u00b7 D", tag: "group_room", detail: null, linked: null, tp: 3 },
    { d: 7, b: 2, type: "tp", title: "TP3 \u00b7 E", tag: "group_room", detail: null, linked: null, tp: 3 },
    { d: 7, b: 3, type: "tp", title: "TP3 \u00b7 F", tag: "group_room", detail: null, linked: null, tp: 3 },
    { d: 7, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised \u00b7 ABC", linked: null, tp: null },
    { d: 7, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 7, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 7, b: 7, type: "input_session", title: "Guided discovery", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 7, b: 8, type: "input_session", title: "MFP", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 7, b: 9, type: "input_session", title: "Filmed observation 2", tag: "whole_group", detail: "With task", linked: null, tp: null },
    { d: 8, b: 1, type: "tp", title: "TP4 \u00b7 A", tag: "group_room", detail: null, linked: null, tp: 4 },
    { d: 8, b: 2, type: "tp", title: "TP4 \u00b7 B", tag: "group_room", detail: null, linked: null, tp: 4 },
    { d: 8, b: 3, type: "tp", title: "TP4 \u00b7 C", tag: "group_room", detail: null, linked: null, tp: 4 },
    { d: 8, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised \u00b7 DEF", linked: null, tp: null },
    { d: 8, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 8, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 8, b: 7, type: "input_session", title: "Giving feedback on tasks", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 8, b: 8, type: "input_session", title: "Error correction", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 8, b: 9, type: "milestone", title: "Writing Stage 2 report \u00b7 ABC", tag: "individual", detail: "Own time", linked: null, tp: null },
    { d: 9, b: 1, type: "tp", title: "TP4 \u00b7 D", tag: "group_room", detail: null, linked: null, tp: 4 },
    { d: 9, b: 2, type: "tp", title: "TP4 \u00b7 E", tag: "group_room", detail: null, linked: null, tp: 4 },
    { d: 9, b: 3, type: "tp", title: "TP4 \u00b7 F", tag: "group_room", detail: null, linked: null, tp: 4 },
    { d: 9, b: 4, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 9, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 9, b: 6, type: "supervised_session", title: "Stage 2 tutorials \u00b7 ABC", tag: "group_room", detail: "DEF writing reports", linked: null, tp: null },
    { d: 9, b: 7, type: "input_session", title: "Filmed observation 3", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 9, b: 8, type: "supervised_session", title: "Stage 2 tutorials \u00b7 DEF", tag: "group_room", detail: "One-to-one, own tutor", linked: null, tp: null },
    { d: 9, b: 9, type: "supervised_session", title: "GTKY / unassessed prep", tag: "group_room", detail: "Trainee planning session", linked: null, tp: null },
    { d: 10, b: 1, type: "input_session", title: "Demo lesson", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 10, b: 2, type: "input_session", title: "Demo lesson", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 10, b: 3, type: "supervised_session", title: "Unassessed teach / GTKY", tag: "group_room", detail: "New level", linked: null, tp: null },
    { d: 10, b: 4, type: "supervised_session", title: "Unassessed teach / GTKY", tag: "group_room", detail: "New level", linked: null, tp: null },
    { d: 10, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 10, b: 6, type: "supervised_session", title: "Stage 1 tutorials \u00b7 ABC", tag: "group_room", detail: "DEF supervised \u00b7 assignments", linked: null, tp: null },
    { d: 10, b: 7, type: "supervised_session", title: "Supervised \u00b7 assignments", tag: "group_room", detail: "Tutors marking", linked: null, tp: null },
    { d: 10, b: 8, type: "supervised_session", title: "Stage 1 tutorials \u00b7 DEF", tag: "group_room", detail: "One-to-one, own tutor", linked: null, tp: null },
    { d: 10, b: 9, type: "supervised_session", title: "Supervised \u00b7 assignments", tag: "group_room", detail: "Early finish, if done", linked: null, tp: null },
    { d: 11, b: 1, type: "tp", title: "TP5 \u00b7 A", tag: "group_room", detail: "New level", linked: null, tp: 5 },
    { d: 11, b: 2, type: "tp", title: "TP5 \u00b7 B", tag: "group_room", detail: "New level", linked: null, tp: 5 },
    { d: 11, b: 3, type: "tp", title: "TP5 \u00b7 C", tag: "group_room", detail: "New level", linked: null, tp: 5 },
    { d: 11, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised \u00b7 DEF", linked: null, tp: null },
    { d: 11, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 11, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 11, b: 7, type: "input_session", title: "Functional language", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 11, b: 8, type: "input_session", title: "Test-Teach-Test", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 11, b: 9, type: "milestone", title: "Consultation", tag: "consultation", detail: "Bookable", linked: null, tp: null },
    { d: 12, b: 1, type: "tp", title: "TP5 \u00b7 D", tag: "group_room", detail: null, linked: null, tp: 5 },
    { d: 12, b: 2, type: "tp", title: "TP5 \u00b7 E", tag: "group_room", detail: null, linked: null, tp: 5 },
    { d: 12, b: 3, type: "tp", title: "TP5 \u00b7 F", tag: "group_room", detail: null, linked: null, tp: 5 },
    { d: 12, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised \u00b7 ABC", linked: null, tp: null },
    { d: 12, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 12, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 12, b: 7, type: "input_session", title: "Productive skills \u2014 writing", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 12, b: 8, type: "input_session", title: "Teaching speaking", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 12, b: 9, type: "milestone", title: "Consultation", tag: "consultation", detail: "Bookable", linked: null, tp: null },
    { d: 13, b: 1, type: "tp", title: "TP6 \u00b7 A", tag: "group_room", detail: null, linked: null, tp: 6 },
    { d: 13, b: 2, type: "tp", title: "TP6 \u00b7 B", tag: "group_room", detail: null, linked: null, tp: 6 },
    { d: 13, b: 3, type: "tp", title: "TP6 \u00b7 C", tag: "group_room", detail: null, linked: null, tp: 6 },
    { d: 13, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised \u00b7 DEF", linked: null, tp: null },
    { d: 13, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 13, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 13, b: 7, type: "input_session", title: "Lesson framework", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 13, b: 8, type: "input_session", title: "Teaching listening", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 13, b: 9, type: "input_session", title: "Syllabus planning \u00b7 ABC", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 14, b: 1, type: "tp", title: "TP6 \u00b7 D", tag: "group_room", detail: null, linked: null, tp: 6 },
    { d: 14, b: 2, type: "tp", title: "TP6 \u00b7 E", tag: "group_room", detail: null, linked: null, tp: 6 },
    { d: 14, b: 3, type: "tp", title: "TP6 \u00b7 F", tag: "group_room", detail: null, linked: null, tp: 6 },
    { d: 14, b: 4, type: "supervised_session", title: "Lesson planning", tag: "group_room", detail: "Supervised \u00b7 ABC", linked: null, tp: null },
    { d: 14, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 14, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 14, b: 7, type: "input_session", title: "Language practice", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 14, b: 8, type: "input_session", title: "Drilling technique", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 14, b: 9, type: "input_session", title: "Syllabus planning \u00b7 DEF", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 15, b: 1, type: "milestone", title: "Late start \u00b7 10:00\u201310:45", tag: "individual", detail: null, linked: null, tp: null },
    { d: 15, b: 2, type: "input_session", title: "Supervised review \u2014 presenting language", tag: "whole_group", detail: "Submit for tutor check", linked: null, tp: null },
    { d: 15, b: 3, type: "input_session", title: "Supervised review \u2014 phonology", tag: "whole_group", detail: "Submit for tutor check", linked: null, tp: null },
    { d: 15, b: 4, type: "input_session", title: "Supervised review \u2014 classroom management", tag: "whole_group", detail: "Submit for tutor check", linked: null, tp: null },
    { d: 15, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 15, b: 6, type: "milestone", title: "Stage 3 tutorials", tag: "individual", detail: "By invitation", linked: null, tp: null },
    { d: 15, b: 7, type: "milestone", title: "Stage 3 tutorials", tag: "individual", detail: "By invitation", linked: null, tp: null },
    { d: 15, b: 8, type: "milestone", title: "Stage 3 tutorials", tag: "individual", detail: "By invitation", linked: null, tp: null },
    { d: 15, b: 9, type: "assignment_due", title: "Early finish", tag: null, detail: null, linked: null, tp: null },
    { d: 16, b: 1, type: "tp", title: "TP7 \u00b7 A", tag: "group_room", detail: null, linked: null, tp: 7 },
    { d: 16, b: 2, type: "tp", title: "TP7 \u00b7 B", tag: "group_room", detail: null, linked: null, tp: 7 },
    { d: 16, b: 3, type: "tp", title: "TP7 \u00b7 C", tag: "group_room", detail: null, linked: null, tp: 7 },
    { d: 16, b: 4, type: "milestone", title: "Lesson planning", tag: "individual", detail: "Bookable \u00b7 DEF", linked: null, tp: null },
    { d: 16, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 16, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 16, b: 7, type: "supervised_session", title: "Assessor meeting", tag: "group_room", detail: "Ahead of the visit", linked: null, tp: null },
    { d: 16, b: 8, type: "input_session", title: "Filmed observation 4", tag: "whole_group", detail: "With task", linked: null, tp: null },
    { d: 16, b: 9, type: "input_session", title: "Filmed observation 5", tag: "whole_group", detail: "With task", linked: null, tp: null },
    { d: 17, b: 0, type: "assignment_due", title: "Assignment 2 (LRT) due \u00b7 DEF", tag: null, detail: null, linked: "LRT", tp: null },
    { d: 17, b: 1, type: "tp", title: "TP7 \u00b7 D", tag: "group_room", detail: null, linked: null, tp: 7 },
    { d: 17, b: 2, type: "tp", title: "TP7 \u00b7 E", tag: "group_room", detail: null, linked: null, tp: 7 },
    { d: 17, b: 3, type: "tp", title: "TP7 \u00b7 F", tag: "group_room", detail: null, linked: null, tp: 7 },
    { d: 17, b: 4, type: "milestone", title: "Lesson planning", tag: "individual", detail: "Bookable \u00b7 ABC", linked: null, tp: null },
    { d: 17, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 17, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Self-evaluations lead", linked: null, tp: null },
    { d: 17, b: 7, type: "milestone", title: "LFC assignment writing", tag: "individual", detail: "Own time", linked: null, tp: null },
    { d: 17, b: 8, type: "milestone", title: "LFC assignment writing", tag: "individual", detail: "Own time", linked: null, tp: null },
    { d: 17, b: 9, type: "milestone", title: "Consultation", tag: "consultation", detail: "Bookable", linked: null, tp: null },
    { d: 18, b: 0, type: "assignment_due", title: "Assignment 2 (LRT) due \u00b7 ABC", tag: null, detail: null, linked: "LRT", tp: null },
    { d: 18, b: 1, type: "tp", title: "TP8 \u00b7 A", tag: "group_room", detail: "Final assessed", linked: null, tp: 8 },
    { d: 18, b: 2, type: "tp", title: "TP8 \u00b7 B", tag: "group_room", detail: "Final assessed", linked: null, tp: 8 },
    { d: 18, b: 3, type: "tp", title: "TP8 \u00b7 C", tag: "group_room", detail: "Final assessed", linked: null, tp: 8 },
    { d: 18, b: 4, type: "milestone", title: "Lesson planning", tag: "individual", detail: "Bookable \u00b7 DEF", linked: null, tp: null },
    { d: 18, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 18, b: 6, type: "supervised_session", title: "Feedback", tag: "group_room", detail: "Written feedback only", linked: null, tp: null },
    { d: 18, b: 7, type: "input_session", title: "Teaching literacy", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 18, b: 8, type: "supervised_session", title: "Portfolio check \u00b7 ABC", tag: "group_room", detail: "Every field, every signature", linked: null, tp: null },
    { d: 18, b: 9, type: "milestone", title: "Consultation", tag: "consultation", detail: "Bookable", linked: null, tp: null },
    { d: 19, b: 0, type: "assignment_due", title: "Assignment 4 (LFC) due", tag: null, detail: "09:00", linked: null, tp: null },
    { d: 19, b: 1, type: "tp", title: "TP8 \u00b7 D", tag: "group_room", detail: "Final assessed", linked: null, tp: 8 },
    { d: 19, b: 2, type: "tp", title: "TP8 \u00b7 E", tag: "group_room", detail: "Final assessed", linked: null, tp: 8 },
    { d: 19, b: 3, type: "tp", title: "TP8 \u00b7 F", tag: "group_room", detail: "Final assessed", linked: null, tp: 8 },
    { d: 19, b: 4, type: "supervised_session", title: "Written feedback only", tag: "group_room", detail: "Final TP, no live session", linked: null, tp: null },
    { d: 19, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 19, b: 6, type: "input_session", title: "Professional development and career advice", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 19, b: 7, type: "supervised_session", title: "Final portfolio check", tag: "group_room", detail: "Every field, every signature", linked: null, tp: null },
    { d: 20, b: 1, type: "input_session", title: "Course close", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 20, b: 2, type: "input_session", title: "Course close", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 20, b: 3, type: "input_session", title: "Course close", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 20, b: 4, type: "input_session", title: "Course close", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 20, b: 5, type: "milestone", title: "Lunch", tag: "lunch", detail: null, linked: null, tp: null },
    { d: 20, b: 6, type: "input_session", title: "Course close", tag: "whole_group", detail: null, linked: null, tp: null },
    { d: 20, b: 7, type: "input_session", title: "Course close", tag: "whole_group", detail: null, linked: null, tp: null },
  ];

  // NO group-B TP rows. Ramy, 6 Sep 2026: "we have two groups of six, A, B, C
  // one day, D, E, F the other day. That's it." The letters are slots WITHIN a
  // group, not across the course -- both groups teach the same three slots at
  // the same times, in their own rooms, so the timetable is identical whether
  // the course has one group or two. An earlier pass here generated a parallel
  // G-L set and doubled the day; that was inventing a course shape nobody runs.

  // --- Timetable (capture ids: TP events feed the volunteer demo below) ---
  // Built from designSessions above: every card in Ramy's own timetable,
  // on its real teaching day and time band. TP6 keeps the working Zoom
  // link the volunteer demo needs -- it is the course's "next TP" and the
  // volunteer view pairs a room with a Join button on it.
  // ---- Teaching practice for BOTH groups, with the rotation in the times ----
  //
  // Ramy, 11 Sep 2026: "on a course of twelve you don't get three trainees
  // teaching on one day. You get six, for two different levels." The literal
  // above carried six letters -- A to F, one group split across two days --
  // so Group B was never timetabled and the two groups never taught in
  // parallel. Now every TP day has six lessons: Group A in rooms 2-4, Group B
  // in rooms 5-7, at the same three times, at two levels.
  //
  // Letters are PEOPLE, not slots: A-C and D-F are Group A's two halves, G-I
  // and J-L are Group B's. The order they teach in rotates every round --
  // rotationPosition(slot, 3, tp), the same function src/lib/rotation.ts uses
  // -- so TP1 reads A,B,C, TP2 reads C,A,B, TP3 reads B,C,A, and the rotation
  // is visible on the timetable itself rather than only in the code.
  //
  // tp_group_scope_id is set, which is what lets a tutor's view narrow to
  // their own group's lessons (hub-scope.ts) and keeps the other group's rows
  // off a trainee's day (course-stream-day.ts).
  // Per-group letters: every group is its own A-F (Ramy, 11 Sep 2026 -- "there
  // is no G-L"). Two "TP1 - A" cards then exist, one per group, told apart by
  // room and tp_group_scope_id, which matches how a tutor sees only their own.
  const GROUP_LETTERS = {
    "Group A": { 1: ["A", "B", "C"], 2: ["D", "E", "F"] },
    "Group B": { 1: ["A", "B", "C"], 2: ["D", "E", "F"] },
  };
  const rotationPosition = (baseSlot, size, tp) => (baseSlot + (tp - 1)) % size;
  const tpRows = [];
  for (let tp = 1; tp <= 8; tp += 1) {
    for (const half of [1, 2]) {
      const d = TP_COURSE_DAYS[half][tp - 1];
      for (const [group, byHalf] of Object.entries(GROUP_LETTERS)) {
        byHalf[half].forEach((letter, slot) => {
          tpRows.push({
            d, b: rotationPosition(slot, 3, tp) + 1, type: "tp", title: `TP${tp} \u00b7 ${letter}`,
            tag: "group_room", detail: null, linked: null, tp, scope: tpGroupIds[group],
          });
        });
      }
    }
  }
  const designSessions = [...designSessionsBase.filter((x) => x.type !== "tp"), ...tpRows];
  console.log("TP timetable:", tpRows.length, "lessons across both groups");

  const events = designSessions.map((x) => ({
    // A "due" card is a deadline and belongs in the admin column; a "Q&A"
    // card is a timetabled session that happens to be about an assignment,
    // so it keeps its band and is tagged admin to stay gold.
    // Filmed observations are milestone events, not input sessions: that is
    // how the trainer's board, the Today tab and the resource hub all find
    // them (they query type='milestone' with a "Filmed observation%" title).
    // The design colours them teal like whole-group input, which is a
    // display choice -- the type is what other code reads.
    type: /^Filmed observation/i.test(x.title)
      ? "milestone"
      : x.type === "assignment_due" && !/\bdue\b/i.test(x.title)
        ? "milestone"
        : x.type,
    tagOverride: /^Filmed observation/i.test(x.title)
      ? "whole_group"
      : x.type === "assignment_due" && !/\bdue\b/i.test(x.title)
        ? "admin"
        : null,
    title: x.title,
    day: x.d,
    // b is the cell index in the design's own row array, where 0 is the
    // admin column and 1-9 are the nine time bands -- so the band time is
    // BAND_TIMES[b - 1], not BAND_TIMES[b]. Getting this wrong shifted
    // every session one band late: TP1 · A sat at 10:45 instead of 10:00,
    // the 10:00 column was empty all week, and the 17:15 session fell off
    // the end of the array entirely.
    time: x.b === 0 ? null : BAND_TIMES[x.b - 1],
    tag: x.tag,
    detail: x.detail,
    linked: x.linked,
    tpNumber: x.tp,
    scope: x.scope ?? null,
    shares: x.shares ?? false,
    zoomUrl:
      x.title === "TP6 \u00b7 A" || x.title === "TP6 \u00b7 D" ? "https://zoom.us/j/5551234567" : null,
  }));
  const { data: timetableRows } = await supabase
    .from("course_timetable_events")
    .insert(
      events.map((e) => ({
        course_id: course.id,
        type: e.type,
        title: e.title,
        event_date: courseDay(courseStart, e.day),
        event_time: e.time ?? null,
        tag: e.tagOverride ?? e.tag ?? null,
        detail: e.detail ?? null,
        linked_assignment_type: e.linked ?? null,
        // Real trainer-facing timetable events link a TP calendar day to its
        // rotation number so the volunteer view, the portfolio pages and the
        // §9.1.1 six-hours check can resolve a topic, materials and the TP
        // slots still ahead. The app's own skeleton generator sets it
        // (timetable-skeleton.ts); the demo has to set it by hand.
        //
        // This line is the fix made on 25 Aug 2026. A SECOND
        // linked_tp_number followed it in the same object literal --
        // Number(e.title.replace("TP", "")) -- which silently won, and on a
        // title like "TP1 · A" produced Number("1 · A") = NaN, stored as
        // null. So every TP event in the demo carried no TP number for
        // twelve days while the code read as though it did. Removed 6 Sep
        // 2026. Number() returning NaN instead of throwing is what hid it.
        linked_tp_number: e.tpNumber ?? null,
        tp_group_scope_id: e.scope ?? null,
        zoom_url: e.zoomUrl ?? null,
        // Which non-TP sessions volunteer students may see materials for --
        // the demo lesson, the unassessed teach and the introduction, so the
        // Share materials page has something to show (5 Sep 2026).
        shares_materials: e.type !== "tp" && Boolean(e.shares),
        created_by: trainerId,
      }))
    )
    .select("id, title");
  const tpEventIdByTitle = new Map((timetableRows ?? []).filter((r) => r.title.startsWith("TP")).map((r) => [r.title, r.id]));

  // --- Tutorials and consultations (design_handoff_tutorials_consultations,
  // 5 Sep 2026) --- Without these the section under the timetable is empty
  // cards on every walkthrough: a Stage 2 sheet for Group A with two
  // bookings, Stage 1 invites in two states, Priya flagged for Stage 3, and
  // a consultation block per tutor with one booking (migration 0275).
  const tutorialAt = (n, band) => ({ event_date: courseDay(courseStart, n), event_time: BAND_TIMES[band - 1] });
  const stamp = new Date().toISOString();
  const { data: s2Event } = await supabase
    .from("course_timetable_events")
    .insert({ course_id: course.id, type: "milestone", tag: "stage2_tutorial", title: "Stage 2 tutorials — Group A", ...tutorialAt(12, 6), created_by: trainer2Id })
    .select("id")
    .single();
  const { data: s2Block } = await supabase
    .from("stage2_tutorial_blocks")
    .insert({ course_id: course.id, timetable_event_id: s2Event.id, tp_group_id: tpGroup.id, created_by: trainer2Id })
    .select("id")
    .single();
  await supabase.rpc("set_stage2_slot_count", { p_block_id: s2Block.id, p_slot_count: 6 });
  await supabase.from("stage2_tutorial_slots").update({ trainee_id: trainees["Amara Okafor"], booked_at: stamp }).eq("block_id", s2Block.id).eq("position", 1);
  await supabase.from("stage2_tutorial_slots").update({ trainee_id: trainees["Priya Sharma"], booked_at: stamp }).eq("block_id", s2Block.id).eq("position", 2);
  for (const [name, day, confirmed] of [
    ["Amara Okafor", 6, true],
    ["Daniel Kim", 7, false],
  ]) {
    const { data: ev } = await supabase
      .from("course_timetable_events")
      .insert({ course_id: course.id, type: "milestone", tag: "stage1_tutorial", title: `Stage 1 tutorial — ${name}`, ...tutorialAt(day, 8), created_by: trainer2Id })
      .select("id")
      .single();
    await supabase.from("individual_tutorial_invites").insert({
      course_id: course.id,
      trainee_id: trainees[name],
      stage: "stage1",
      timetable_event_id: ev.id,
      confirmed_at: confirmed ? stamp : null,
      created_by: trainer2Id,
    });
  }
  await supabase.from("celta5_records").update({ stage3_tutorial_required: true }).eq("trainee_id", trainees["Priya Sharma"]).eq("course_id", course.id);
  for (const [tutorId, tutorName, day, band, slotCount, bookedBy] of [
    [trainerId, "Jordan Blake", 13, 7, 4, ["Amara Okafor"]],
    [trainer2Id, "Marcus Webb", 14, 4, 3, []],
  ]) {
    const { data: ev } = await supabase
      .from("course_timetable_events")
      .insert({ course_id: course.id, type: "milestone", tag: "consultation", title: `Consultation — ${tutorName}`, detail: "Bookable", ...tutorialAt(day, band), created_by: tutorId })
      .select("id")
      .single();
    const { data: cb } = await supabase
      .from("consultation_blocks")
      .insert({ course_id: course.id, tutor_profile_id: tutorId, timetable_event_id: ev.id, created_by: tutorId })
      .select("id")
      .single();
    await supabase.rpc("set_consultation_slot_count", { p_block_id: cb.id, p_slot_count: slotCount });
    let position = 1;
    for (const who of bookedBy) {
      await supabase.from("consultation_slots").update({ trainee_id: trainees[who], booked_at: stamp }).eq("block_id", cb.id).eq("position", position++);
    }
  }
  console.log("tutorials: Stage 2 sheet 2 of 6 booked, 2 Stage 1 invites, Priya flagged for Stage 3, 2 consultation blocks");


  // --- Filmed observations -------------------------------------------------
  // The five recordings, their three auto-pauses each, and the four
  // observation tasks. These were originally inserted by migrations
  // 0241-0243, which join the demo centre's own timetable events -- so when
  // the demo centre was rebuilt on 29 Aug 2026 the events they attached to
  // went with it, migrations don't re-run, and the whole feature came back
  // empty. Ramy had checked it working the day before.
  //
  // Seeded here instead because that is the difference that bit us: a
  // migration runs once, the seed runs on every rebuild. Anything that is
  // demo CONTENT rather than schema belongs in this file.
  const foRecordings = [["Filmed observation 1", "Getting to know you -- online", "https://youtu.be/4UKgBuDBALE", 59], ["Filmed observation 2", "Reading and lexis", "https://youtu.be/lMU9LaJjpss", 44], ["Filmed observation 3", "Vocabulary: function and pronunciation", "https://youtu.be/JDIRpzYupPU", 35], ["Filmed observation 4", "Teaching a reading lesson -- pre-intermediate", "https://youtu.be/YlzxRJY7Wbo", 36], ["Filmed observation 5", "Drilling", "https://youtu.be/5v346qd5Rps", 39]];
  const foBreaks = [[1, 0.25, "Pause. Catch up on your notes, then compare notes with your TP group."], [2, 0.5, "Halfway. Add anything you have spotted, and compare notes with your TP group -- you will each have caught different things."], [3, 0.75, "Last pause. Get your notes down while it is fresh, and compare notes with your TP group before the end."]];
  const foTasks = [{"event_title": "Filmed observation 1", "prompts": ["Before you watch: from the input session, write down in your own words what classroom management covers. Keep the list in front of you while you watch.", "How does the teacher use the space — where do they stand, when do they move, when do they get out of the way?", "How are learners grouped, and how do the groupings change? Note how the teacher sets up each change and how long it takes.", "What does the teacher do while learners are working? Note what they are listening for, and what they do with what they hear.", "Instructions and checking: pick two task set-ups. Write down what the teacher said, and how they knew the class had understood.", "Strengths. Name three things this teacher does well in managing the class. Give a timestamp for each.", "Action points. Name two things you would do differently, and say what you would do instead — not just what was wrong.", "One thing from this lesson you intend to use in your own teaching practice this week."], "prompt_1": "Before you watch: from the input session, write down in your own words what classroom management covers. Keep the list in front of you while you watch.", "prompt_2": "How does the teacher use the space — where do they stand, when do they move, when do they get out of the way?", "general_prompt": "One thing from this lesson you intend to use in your own teaching practice this week.", "rating_label": "How much of the lesson was learners working rather than the teacher managing?", "rating_options": ["Mostly teacher", "Fairly even", "Mostly learners"]}, {"event_title": "Filmed observation 2", "prompts": ["Is this a language lesson or a skills lesson? Say how you decided, and give the moment in the recording that told you.", "If it is a skills lesson, is it receptive or productive? If it is a language lesson, is the focus grammar, vocabulary, functional language or pronunciation?", "Name the framework the teacher is working to. If it does not match one you have been taught, describe the shape you actually see.", "Map the stages with timestamps. For each stage write one line: what the learners were asked to do.", "What is the main aim of this lesson, in one sentence, in your own words? Do not copy the teacher’s wording.", "Which stage did the most work towards that aim, and which stage could have been cut?", "How does each stage prepare the one after it? Find one link that works well and one that is missing.", "Action point: one change to the staging you would make, and what it would achieve."], "prompt_1": "Is this a language lesson or a skills lesson? Say how you decided, and give the moment in the recording that told you.", "prompt_2": "If it is a skills lesson, is it receptive or productive? If it is a language lesson, is the focus grammar, vocabulary, functional language or pronunciation?", "general_prompt": "Action point: one change to the staging you would make, and what it would achieve.", "rating_label": "How clearly did the shape of the lesson come across?", "rating_options": ["Hard to follow", "Mostly clear", "Very clear"]}, {"event_title": "Filmed observation 3", "prompts": ["Pick any five minutes of the lesson. Note roughly how much of it is the teacher talking, and whether that talk was doing a job.", "Write down three questions the teacher asked, exactly as asked. For each, say what it was for: checking, eliciting, or moving the lesson on.", "Find one point where the teacher told the class something they could have got from the learners instead.", "Note any language the teacher used that was above the level of the class. What would you have said?", "How do learners respond — in full, in single words, to the teacher, or to each other? Give examples with timestamps.", "Errors: note two the teacher dealt with and one they let go. Was each decision the right one?", "Strengths. Two things about the way this teacher talks to the class that you would take for yourself.", "Action point: one thing you would change about the teacher’s language, and why."], "prompt_1": "Pick any five minutes of the lesson. Note roughly how much of it is the teacher talking, and whether that talk was doing a job.", "prompt_2": "Write down three questions the teacher asked, exactly as asked. For each, say what it was for: checking, eliciting, or moving the lesson on.", "general_prompt": "Action point: one thing you would change about the teacher’s language, and why.", "rating_label": "Balance of teacher talk to learner talk", "rating_options": ["Teacher-heavy", "Balanced", "Learner-heavy"]}, {"event_title": "Filmed observation 4", "prompts": ["What could the learners do at the end of the lesson that they could not do at the start? Give the evidence you are basing that on.", "Find the point in the lesson where you can first see learning happening. What is happening on screen?", "Pick one learner you can see or hear throughout. Track what they do across the lesson and what they get out of it.", "Were all learners engaged, or only some? Note any learner who dropped out of the lesson, and when.", "How does the teacher find out what has been learned? Note every check they make, and how reliable each one is.", "Feedback: how is it given — on the spot, delayed, on the board, learner to learner? Give timestamps.", "Strengths. Two things the teacher did that made the learning happen.", "Action point: one change that would have got more learning out of the same 45 minutes."], "prompt_1": "What could the learners do at the end of the lesson that they could not do at the start? Give the evidence you are basing that on.", "prompt_2": "Find the point in the lesson where you can first see learning happening. What is happening on screen?", "general_prompt": "Action point: one change that would have got more learning out of the same 45 minutes.", "rating_label": "How far was the aim of the lesson achieved?", "rating_options": ["Partly", "Largely", "Fully"]}];

  const { data: foEvents } = await supabase
    .from("course_timetable_events")
    .select("id, title")
    .eq("course_id", course.id)
    .in("title", foRecordings.map((r) => r[0]));
  const foEventByTitle = new Map((foEvents ?? []).map((e) => [e.title, e.id]));

  const foSessionRows = foRecordings
    .filter(([title]) => foEventByTitle.has(title))
    .map(([title, lessonTitle, url, minutes]) => ({
      course_id: course.id,
      timetable_event_id: foEventByTitle.get(title),
      lesson_title: lessonTitle,
      recording_url: url,
      length_minutes: minutes,
    }));
  const { data: foSessions, error: foErr } = await supabase
    .from("filmed_observation_sessions")
    .insert(foSessionRows)
    .select("id, timetable_event_id, length_minutes");
  if (foErr) console.warn("  filmed observations:", foErr.message);

  const foSessionByEvent = new Map((foSessions ?? []).map((s) => [s.timetable_event_id, s]));

  const breakRows = (foSessions ?? []).flatMap((s) =>
    foBreaks.map(([n, fraction, prompt]) => ({
      session_id: s.id,
      break_number: n,
      timestamp_seconds: Math.round((s.length_minutes ?? 0) * 60 * fraction),
      duration_seconds: 90,
      prompt,
    }))
  );
  if (breakRows.length) {
    const { error } = await supabase.from("filmed_observation_breaks").insert(breakRows);
    if (error) console.warn("  filmed observation breaks:", error.message);
  }

  const taskRows = foTasks
    .map((t) => {
      const eventId = foEventByTitle.get(t.event_title);
      const session = eventId ? foSessionByEvent.get(eventId) : null;
      if (!session) return null;
      return {
        session_id: session.id,
        prompts: t.prompts,
        prompt_1: t.prompt_1,
        prompt_2: t.prompt_2,
        general_prompt: t.general_prompt,
        rating_label: t.rating_label,
        rating_options: t.rating_options,
      };
    })
    .filter(Boolean);
  if (taskRows.length) {
    const { error } = await supabase.from("filmed_observation_tasks").insert(taskRows);
    if (error) console.warn("  filmed observation tasks:", error.message);
  }
  console.log("filmed observations:", foSessionRows.length, "recordings,", breakRows.length, "breaks,", taskRows.length, "tasks");

  // --- Volunteer: token-based, no real login (migration 0030). Seeded
  // already past the one-time signup screen so the demo lands straight on
  // the ongoing dashboard, and with attendance against the TPs already
  // taught so "hours toward certificate" isn't zero. A permanently reusable
  // token, same as every other demo entry point. ---
  const { data: volunteer } = await supabase
    .from("volunteer_students")
    .insert({
      course_id: course.id,
      name: "Emeka Nwosu",
      level: "Intermediate",
      signup_completed_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    })
    .select("id")
    .single();
  const { data: volunteerToken } = await supabase
    .from("course_access_tokens")
    .insert({
      course_id: course.id,
      role: "volunteer_student",
      volunteer_student_id: volunteer.id,
      expires_at: new Date(Date.now() + 5 * 365 * 86400000).toISOString(),
    })
    .select("token")
    .single();
  // Grace Adeyemi -- the OTHER end of the volunteer journey, and the half
  // that has been broken.
  //
  // /demo/journey/volunteer-signup looks her up by name, resets her to
  // not-yet-signed-up and lands on the real signup form; every volunteer
  // email on /demo/journey is addressed to her. She was never in this seed,
  // so the last centre rebuild wiped her and that route has been falling
  // through to its fallback and dumping people on the login page ever
  // since -- which is exactly what "I can't see the volunteer journey"
  // turned out to be.
  //
  // See [[feedback_seed_vs_migration_for_demo_content]]: anything the demo
  // depends on belongs here, where it is recreated on every rebuild, not in
  // a migration that runs once.
  //
  // Deliberately left with signup_completed_at null -- Emeka above shows
  // the ongoing dashboard of someone already signed up; Grace exists to
  // show the very first screen, the six written questions and the eight
  // recording prompts.
  const { data: graceVolunteer } = await supabase
    .from("volunteer_students")
    .insert({
      course_id: course.id,
      name: "Grace Adeyemi",
      level: "Elementary",
      signup_completed_at: null,
    })
    .select("id")
    .single();
  await supabase.from("course_access_tokens").insert({
    course_id: course.id,
    role: "volunteer_student",
    volunteer_student_id: graceVolunteer.id,
    expires_at: new Date(Date.now() + 5 * 365 * 86400000).toISOString(),
  });
  console.log("volunteer signup demo: Grace Adeyemi seeded, not yet signed up");

  // Matched on the title PREFIX, not the whole title.
  //
  // This looked up "TP1", "TP2", "TP3" exactly, but a TP event is titled
  // "TP1 · A" once it is split by subgroup. Every lookup missed,
  // .filter(Boolean) emptied the list, and the length guard below skipped
  // the insert without a word -- so the volunteer demo has been showing a
  // signed-up student with zero attendance and 0.0 hours toward their
  // certificate for as long as those titles have carried a suffix. Ramy,
  // 30 Aug 2026, looking at it: "why is it showing the old landing page?"
  // It was not the old page; it was the right page with no data in it.
  //
  // Also spread across every past TP day rather than three, and
  // deliberately uneven, so the register demonstrates its own rule: most
  // days attended in full, one day a single block (the 45-89 minute
  // "partial" mark, which credits no hours but is still recorded), and one
  // day missed entirely.
  // Deliberately uneven, so the register demonstrates its own rule (and
  // actually is now -- this used to attend every block of every day, so
  // the half-filled "one lesson" mark never appeared anywhere on the demo;
  // Ramy went looking for it 5 Sep 2026): full days, then one day of a
  // single block (one lesson -- recorded, banks nothing), then one day
  // missed entirely.
  const { data: earlyTpRows } = await supabase
    .from("course_timetable_events")
    .select("id, event_date")
    .eq("course_id", course.id)
    .eq("type", "tp")
    .order("event_date")
    .order("event_time");
  const earlyDates = [...new Set((earlyTpRows ?? []).map((e) => e.event_date))].slice(0, 6);
  const attendanceRows = earlyDates.flatMap((date, i) => {
    const blocks = (earlyTpRows ?? []).filter((e) => e.event_date === date);
    const take = i === 4 ? 1 : i === 5 ? 0 : blocks.length;
    return blocks.slice(0, take).map((e) => ({ volunteer_student_id: volunteer.id, timetable_event_id: e.id }));
  });
  if (attendanceRows.length > 0) {
    const { error: attErr } = await supabase.from("volunteer_attendance").insert(attendanceRows);
    if (attErr) console.warn("  volunteer attendance:", attErr.message);
  } else {
    console.warn("  volunteer attendance: no TP1-3 events matched -- check the title format");
  }
  console.log("volunteer attendance:", attendanceRows.length, "rows");

  // --- Everything below was fixed live on 30 Aug and would have evaporated
  // on the next rebuild, which is the single thing that caused most of that
  // day's "it regressed" confusion. Each of these is a screen that looks
  // broken without its data, not a nice-to-have. ---

  // 1. Rooms. course_timetable_events.detail is where a room number lives,
  // and the volunteer's card shows it on the Where line. Without it a
  // volunteer walking to a building is told only "In person at the centre".
  // One room per subgroup letter, so a group keeps the same room all course.
  {
    const { data: tpEvents } = await supabase
      .from("course_timetable_events")
      .select("id, title, linked_tp_number, tp_group_scope_id")
      .eq("course_id", course.id)
      .eq("type", "tp");
    // Room and level per group, read off the schedule the engine also uses.
    // Group A teaches in rooms 2-4, Group B in 5-7; on any one day the six
    // lessons are in six different rooms. Levels swap at TP4, matching the
    // per-group course_tp_schedule above, so a card's level always agrees with
    // the plan the engine assigned for it.
    const groupNameById = { [tpGroupIds["Group A"]]: "Group A", [tpGroupIds["Group B"]]: "Group B" };
    const ROOM_BY_GROUP = { "Group A": [2, 3, 4], "Group B": [5, 6, 7] };
    const SLOT_OF_LETTER = { A: 0, B: 1, C: 2, D: 0, E: 1, F: 2 };
    const firstLevel = { "Group A": "A2", "Group B": "B1+" };
    const levelForGroupTp = (g, tp) => ((tp ?? 1) <= 3 ? firstLevel[g] : firstLevel[g] === "A2" ? "B1+" : "A2");
    for (const e of tpEvents ?? []) {
      const letter = (e.title.match(/·\s*([A-F])/) || [])[1];
      const g = groupNameById[e.tp_group_scope_id];
      if (!letter || !g) continue;
      const room = ROOM_BY_GROUP[g][SLOT_OF_LETTER[letter]] ?? 2;
      await supabase
        .from("course_timetable_events")
        .update({ detail: `Room ${room} · ${levelForGroupTp(g, e.linked_tp_number)}` })
        .eq("id", e.id);
    }
    console.log("rooms:", (tpEvents ?? []).length, "TP events");

    // Registers. The trainer hub raises "Register not logged" for any TP in
    // the last seven days without a register_submitted_at, and nothing ever
    // set one -- twelve alerts, every one of them the fixture's fault rather
    // than the tutor's. A register is taken at the end of the session, so it
    // is stamped for every TP whose day has been and gone.
    const pastTpIds = (
      await supabase
        .from("course_timetable_events")
        .select("id, event_date")
        .eq("course_id", course.id)
        .eq("type", "tp")
        .lt("event_date", todayIso)
    ).data ?? [];
    for (const e of pastTpIds) {
      await supabase
        .from("course_timetable_events")
        .update({ register_submitted_at: new Date(`${e.event_date}T16:00:00Z`).toISOString() })
        .eq("id", e.id);
    }
    console.log("registers logged:", pastTpIds.length, "past TP sessions");
  }

  // 2. Amara's TPs that are STILL AHEAD.
  //
  // An untaught plan_assignment is what makes the hero show the lesson, the
  // time, the room and "Open your plan" -- without one the landing correctly
  // concludes she has nothing left to teach, which Ramy once read as the card
  // having lost its dimensions. It had not; it had lost its content.
  //
  // Which rounds land here is the calendar's decision, not a constant. It used
  // to hardcode "7 and 8 are still to come", which was true the day it was
  // written and false a fortnight later -- their dates had passed and the
  // record still called them upcoming, which is exactly how the landing came
  // to say "All your TPs are taught" and "TP7 plan" in the same breath. And at
  // --stage precourse it was worse: a course that had not started yet handed
  // her TP7 as her next lesson, with TP1 to TP6 missing entirely.
  //
  // Everything not in the taught block above belongs here, including the rounds
  // --unlogged deliberately leaves open: a lesson that happened and was never
  // written up IS an untaught plan with a date behind it, and that is the whole
  // state we want to be able to reproduce on purpose.
  {
    const amaraTps = [
      { short_title: "Present perfect — life experience", main_lesson_aim: "By the end of the lesson learners will be better able to talk about life experience using the present perfect." },
      { short_title: "Reading for gist and detail — city life", main_lesson_aim: "By the end of the lesson learners will have practised reading for gist and detail in the context of an article about city life." },
      { short_title: "Vocabulary — air travel", main_lesson_aim: "By the end of the lesson learners will be better able to use vocabulary for air travel." },
      { short_title: "Making suggestions", main_lesson_aim: "By the end of the lesson learners will be better able to make and respond to suggestions." },
      { short_title: "Listening for specific information", main_lesson_aim: "By the end of the lesson learners will have practised listening for specific information." },
      { short_title: "Second conditional in context", main_lesson_aim: "By the end of the lesson learners will be better able to use the second conditional to talk about imagined situations." },
      { short_title: "Giving advice — should and ought to", main_lesson_aim: "By the end of the lesson learners will be better able to give advice using should/ought to in the context of moving to a new city." },
      { short_title: "Reading for gist — city guides", main_lesson_aim: "By the end of the lesson learners will have practised reading for gist and specific information in the context of short city guides." },
    ];
    const alreadyLogged = tpRoundsLogged(halfOf("Amara Okafor"));
    const ahead = amaraTps
      .map((tp, i) => ({ ...tp, tp_number: i + 1 }))
      .filter((tp) => tp.tp_number > alreadyLogged);
    for (const tp of ahead) {
      await supabase.from("plan_assignments").insert({
        course_id: course.id,
        trainee_id: trainees["Amara Okafor"],
        tp_number: tp.tp_number,
        short_title: tp.short_title,
        main_lesson_aim: tp.main_lesson_aim,
        aim_type: aimTypeOf(tp.short_title || tp.main_lesson_aim),
        density_tier: "coaching_prose",
        class_grouping: "whole_class",
        assigned_by: trainerId,
        taught_at: null,
      });
    }
    console.log(
      `Amara: ${alreadyLogged} TP(s) logged, ${ahead.length} assigned untaught (TP${ahead.map((t) => t.tp_number).join(", TP") || "-"})`
    );
  }

  // 3. Announcements. The trainee landing's middle card is one of three and
  // read "Nothing posted yet" on every course. Note sent_at: scheduling came
  // later (migration 0093) and the card filters on it, so an announcement
  // without sent_at is invisible however good it looks in the table.
  {
    const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString();
    const posts = [
      { pinned: true, title: "Reading for tomorrow is chapter 4 only, not 4 and 5", body: "Apologies for the confusion in yesterday's handout. Chapter 4 only. If you have already read 5, no harm done.", h: 20 },
      { pinned: false, title: "Observation slots for Thursday are open", body: "Six slots, first come first served. Sign up on the timetable -- two of you still need a second observation before the end of week 3.", h: 3 },
      { pinned: false, title: "Assignment 2 briefs are in Resources", body: "Focus on the Learner. The brief, the marking criteria and last course's worked example are all in the Resource Hub.", h: 52 },
    ];
    const { error } = await supabase.from("course_broadcasts").insert(
      posts.map((p) => ({
        course_id: course.id,
        author_id: trainerId,
        title: p.title,
        body: p.body,
        pinned: p.pinned,
        created_at: hoursAgo(p.h),
        sent_at: hoursAgo(p.h),
      }))
    );
    if (error) console.warn("  announcements:", error.message);
    else console.log("announcements:", posts.length);
  }
  // Several shared materials off every one of Amara's TPs, not one apiece --
  // volunteer-view-full-spec.md's own mockup shows a real handout COUNT
  // (2-3, not always 1) on every attended/missed row, and Ramy caught the
  // gap directly: "every TP should have the material so the students can
  // access them."
  for (const { planId, materialNames } of amaraTpPlanIds) {
    for (const materialName of materialNames) {
      const assetFile = HANDOUT_ASSET[materialName];
      const storagePath = `${center.id}/${trainees["Amara Okafor"]}/${planId}/${crypto.randomUUID()}.pdf`;
      const fileBytes = fs.readFileSync(new URL(`./seed-assets/tp-materials/${assetFile}`, import.meta.url));
      const { error: uploadErr } = await supabase.storage.from("tp-materials").upload(storagePath, fileBytes, { contentType: "application/pdf" });
      if (uploadErr) {
        console.log("upload failed for", materialName, uploadErr.message);
        continue;
      }
      const { data: material } = await supabase
        .from("tp_materials")
        .insert({
          tp_plan_id: planId,
          trainee_id: trainees["Amara Okafor"],
          file_name: materialName,
          file_type: "pdf",
          storage_path: storagePath,
        })
        .select("id")
        .single();
      await supabase.from("volunteer_shared_materials").insert({
        course_id: course.id,
        tp_material_id: material.id,
        shared_by: trainerId,
      });
    }
  }
  console.log("volunteer token:", volunteerToken.token);

  // --- Admissions pipeline / payments realism for the centre-admin demo:
  // one applicant paid in full, one mid-instalment-plan with an overdue
  // payment, so the payments view shows both a green and a pending state
  // (src/lib/payments/applicant-payment-state.ts's derived states). ---
  const { data: applicants } = await supabase
    .from("applicants")
    .insert([
      {
        center_id: center.id,
        intake_course_id: course.id,
        full_name: "Noor Iqbal",
        email: "demo-applicant-noor@celtaconnect.com",
        stage: "accepted",
        deposit_amount: 500,
        deposit_paid_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      },
      {
        center_id: center.id,
        intake_course_id: course.id,
        full_name: "Ben Foster",
        email: "demo-applicant-ben@celtaconnect.com",
        stage: "accepted",
        deposit_amount: 500,
        deposit_paid_at: new Date(Date.now() - 35 * 86400000).toISOString(),
      },
      {
        // The applicant the JOURNEY walks -- distinct from the two above,
        // which exist for the payments views.
        //
        // /demo/journey/interview and /demo/journey/offer both look this
        // person up by email, reset them to a fresh not-yet-booked state and
        // redirect. With no row to find, both took their fallback and landed
        // on /login -- two dead links on the page Ramy demos from, failing
        // silently. Same shape as Grace Adeyemi and the volunteer signup.
        //
        // Left at task_returned on purpose: that is the stage the interview
        // route expects to move them on from, and it is where the journey
        // picks them up.
        center_id: center.id,
        intake_course_id: course.id,
        full_name: "Tariq Osei",
        email: "demo-applicant-journey@celtaconnect.com",
        stage: "task_returned",
      },
    ])
    .select("id, full_name");
  const noor = applicants.find((a) => a.full_name === "Noor Iqbal");
  const ben = applicants.find((a) => a.full_name === "Ben Foster");

  const { data: noorPlan } = await supabase
    .from("payment_plans")
    .insert({ center_id: center.id, course_id: course.id, applicant_id: noor.id, total_amount: 3000, currency: "GBP", instalment_count: 3 })
    .select("id")
    .single();
  await supabase.from("payments").insert([
    { center_id: center.id, payment_plan_id: noorPlan.id, instalment_index: 1, amount: 1000, currency: "GBP", status: "paid", source: "manual", due_date: isoDaysFromNow(-30) },
    { center_id: center.id, payment_plan_id: noorPlan.id, instalment_index: 2, amount: 1000, currency: "GBP", status: "paid", source: "manual", due_date: isoDaysFromNow(-15) },
    { center_id: center.id, payment_plan_id: noorPlan.id, instalment_index: 3, amount: 1000, currency: "GBP", status: "paid", source: "manual", due_date: isoDaysFromNow(-1) },
  ]);

  const { data: benPlan } = await supabase
    .from("payment_plans")
    .insert({ center_id: center.id, course_id: course.id, applicant_id: ben.id, total_amount: 3000, currency: "GBP", instalment_count: 3 })
    .select("id")
    .single();
  await supabase.from("payments").insert([
    { center_id: center.id, payment_plan_id: benPlan.id, instalment_index: 1, amount: 1000, currency: "GBP", status: "paid", source: "manual", due_date: isoDaysFromNow(-30) },
    // Overdue -- feeds the pipeline's own overdue-instalment alert.
    { center_id: center.id, payment_plan_id: benPlan.id, instalment_index: 2, amount: 1000, currency: "GBP", status: "pending", due_date: isoDaysFromNow(-5) },
    { center_id: center.id, payment_plan_id: benPlan.id, instalment_index: 3, amount: 1000, currency: "GBP", status: "pending", due_date: isoDaysFromNow(20) },
  ]);

  // --- A second, completed course so centre-admin's history/reporting
  // views aren't empty. No close-out row inserted -- an already-closed
  // course isn't the point here, just one that finished. ---
  const { data: pastCourse } = await supabase
    .from("courses")
    .insert({
      center_id: center.id,
      name: "CELTA Demo Course (Spring)",
      start_date: isoDaysFromNow(-150),
      end_date: isoDaysFromNow(-120),
      total_hours: 120,
      delivery_mode: "f2f",
      accepting_applications: false,
    })
    .select("id")
    .single();
  await supabase.from("course_tutors").insert({
    course_id: pastCourse.id,
    profile_id: trainerId,
    tutor_role: "main_course_tutor",
    verified_at: new Date(Date.now() - 150 * 86400000).toISOString(),
  });
  // Same assessor as the running course, deliberately: two consecutive
  // courses is exactly Handbook 13.3's limit, so Assessor History shows
  // its own warning rather than a one-row table.
  await supabase.from("course_tutors").insert({
    course_id: pastCourse.id,
    profile_id: demoAssessorId,
    tutor_role: "external_assessor",
  });
  const pastTraineeDefs = [
    { name: "Elena Cruz", email: "demo-elena@celtaconnect.com", grade: "Pass" },
    { name: "Tariq Osei", email: "demo-tariq@celtaconnect.com", grade: "Pass B" },
  ];
  for (const def of pastTraineeDefs) {
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: def.email,
      email_confirm: true,
    });
    if (authErr) throw authErr;
    await supabase.from("profiles").insert({
      id: authUser.user.id,
      email: def.email,
      full_name: def.name,
      role: "trainee",
      center_id: center.id,
      course_id: pastCourse.id,
      course_status: "active",
    });
    await supabase.from("celta5_records").insert({
      course_id: pastCourse.id,
      trainee_id: authUser.user.id,
      hours_attended: 120,
      final_recommended_grade: def.grade,
    });
  }

  // --- Volunteer v2 (design_handoff_volunteer_students_v2, 5 Sep 2026):
  // emails on both volunteers, RSVP replies for the next teaching day, a
  // cross-course identity with prior hours, and an opened link -- so the
  // trainer's register, Today strip and student card all have real states
  // to show on a walkthrough. ---
  await supabase.from("volunteer_students").update({ email: "demo-emeka@celtaconnect.com" }).eq("id", volunteer.id);
  await supabase.from("volunteer_students").update({ email: "demo-grace@celtaconnect.com" }).eq("id", graceVolunteer.id);
  await supabase.from("course_access_tokens").update({ last_opened_at: new Date().toISOString() }).eq("volunteer_student_id", volunteer.id);

  // Emeka volunteered on the Spring course too: one identity, prior hours.
  const { data: emekaPerson } = await supabase
    .from("volunteer_people")
    .insert({ center_id: center.id, email: "demo-emeka@celtaconnect.com" })
    .select("id")
    .single();
  await supabase.from("volunteer_students").update({ volunteer_person_id: emekaPerson.id }).eq("id", volunteer.id);
  const { data: pastEmeka } = await supabase
    .from("volunteer_students")
    .insert({ course_id: pastCourse.id, name: "Emeka Nwosu", level: "Intermediate", email: "demo-emeka@celtaconnect.com", volunteer_person_id: emekaPerson.id })
    .select("id")
    .single();
  const pastTpRows = [];
  for (let day = 0; day < 4; day++) {
    for (let block = 0; block < 3; block++) {
      pastTpRows.push({
        course_id: pastCourse.id,
        type: "tp",
        title: `TP${day + 1}`,
        event_date: isoDaysFromNow(-145 + day),
        event_time: ["10:00", "10:45", "11:30"][block],
        created_by: trainerId,
      });
    }
  }
  const { data: pastTp } = await supabase.from("course_timetable_events").insert(pastTpRows).select("id");
  await supabase.from("volunteer_attendance").insert(
    (pastTp ?? []).map((e) => ({ volunteer_student_id: pastEmeka.id, timetable_event_id: e.id }))
  );

  // RSVP replies for the next teaching day: Emeka said yes, Grace can't.
  const todayIsoV2 = isoDaysFromNow(0);
  const { data: nextTpDay } = await supabase
    .from("course_timetable_events")
    .select("id, event_date")
    .eq("course_id", course.id)
    .eq("type", "tp")
    .gte("event_date", todayIsoV2)
    .order("event_date")
    .order("event_time")
    .limit(3);
  for (const e of nextTpDay ?? []) {
    await supabase.from("volunteer_confirmations").insert({ volunteer_student_id: volunteer.id, timetable_event_id: e.id });
    await supabase.from("volunteer_declines").upsert(
      { volunteer_student_id: graceVolunteer.id, timetable_event_id: e.id },
      { onConflict: "volunteer_student_id,timetable_event_id" }
    );
  }
  console.log("volunteer v2: emails + person link + 9 prior hours + RSVP replies for", (nextTpDay ?? [])[0]?.event_date ?? "no upcoming TP");

  // Emeka's sign-up recording -- so the student card's Listen player and
  // "Transcript on file" line have something real behind them (Ramy,
  // 5 Sep 2026: "I don't see a play icon"). An 18-second synthesised
  // learner-English answer checked into seed-assets, same pattern as the
  // TP materials; the transcript matches it word for word, which is what
  // Focus on the Learner needs.
  const emekaAudio = fs.readFileSync(new URL("./seed-assets/volunteer-signup-emeka.m4a", import.meta.url));
  const emekaAudioPath = `${center.id}/${volunteer.id}-seed.m4a`;
  const { error: audioErr } = await supabase.storage.from("volunteer-signup-audio").upload(emekaAudioPath, emekaAudio, { contentType: "audio/mp4" });
  if (audioErr) console.warn("  volunteer audio:", audioErr.message);
  await supabase.from("volunteer_signup_profiles").insert({
    center_id: center.id,
    course_id: course.id,
    volunteer_student_id: volunteer.id,
    written_answers: { motivation: "Practice speaking for my restaurant job." },
    audio_url: emekaAudioPath,
    transcript:
      "My name is Emeka. I come from Lagos, and I am living in New York since two years. I work in restaurant in evenings. I want practice my speaking, because I understand good, but when I speak, the words is coming slow. I hope the classes help me for talk with customers more easy.",
    transcript_generated_at: new Date().toISOString(),
    l1_language: "Yoruba",
    consent_given_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    recording_consent_given_at: new Date(Date.now() - 18 * 86400000).toISOString(),
  });
  console.log("volunteer audio: Emeka's recording + transcript on file");

  // --- TP tab v2 (design_handoff_teaching_practice_v2, 6 Sep 2026): the
  // tab is the feedback-owed queue, and a demo where every lesson is
  // already marked shows an empty page forever. The last teaching day's
  // three lessons are left owed, in the three states the card is built to
  // show: notes + self-eval + a draft (Continue draft), notes + self-eval
  // and nothing started (Write feedback), and one where the candidate has
  // not sent their self-evaluation yet (amber). Capture notes belong to
  // the group's own tutor -- a tutor writes from their own notes. ---
  const { data: lastTaught } = await supabase
    .from("plan_assignments")
    .select("trainee_id, tp_number, taught_at")
    .eq("course_id", course.id)
    .not("taught_at", "is", null)
    .order("taught_at", { ascending: false })
    .limit(3);
  const owedTrio = lastTaught ?? [];
  const groupTutorId = trainer2Id; // Group A's tutor, set above
  const CAPTURE = [
    { text: "Clear model on the board, learners copied it accurately.", codes: ["4c", "4e"] },
    { text: "Instructions given before handing out the task -- good.", codes: ["4e"] },
    { text: "Two learners left out of the pair check; monitor the far table.", codes: ["4d", "5k"] },
    { text: "Concept checked the target language, but not the negative form.", codes: ["4i"] },
    { text: "Good use of the whiteboard for the timeline.", codes: ["4l"] },
  ];
  for (const [i, lesson] of owedTrio.entries()) {
    // Unpublish: the first keeps its content as a draft, the others start clean.
    if (i === 0) {
      await supabase.from("tp_feedback").update({ submitted_at: null }).eq("trainee_id", lesson.trainee_id).eq("tp_number", lesson.tp_number);
    } else {
      await supabase.from("tp_feedback").delete().eq("trainee_id", lesson.trainee_id).eq("tp_number", lesson.tp_number);
    }
    // The third candidate has not sent their self-evaluation yet.
    if (i === 2) {
      await supabase.from("tp_self_evaluations").update({ submitted_at: null }).eq("trainee_id", lesson.trainee_id).eq("tp_number", lesson.tp_number);
    }
    await supabase.from("tp_capture_notes").insert(
      CAPTURE.slice(0, 3 + i).map((n) => ({
        course_id: course.id,
        trainer_id: groupTutorId,
        trainee_id: lesson.trainee_id,
        tp_number: lesson.tp_number,
        text: n.text,
        criteria_codes: n.codes,
        captured_at: new Date(`${lesson.taught_at.slice(0, 10)}T11:00:00Z`).toISOString(),
      }))
    );
  }
  console.log("tp queue:", owedTrio.length, "lessons left owed with capture notes, one draft, one self-eval pending");

  console.log("DEMO SEED COMPLETE");
  console.log("center_id=" + center.id);
  console.log("course_id=" + course.id);
  console.log("past_course_id=" + pastCourse.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
