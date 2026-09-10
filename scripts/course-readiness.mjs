#!/usr/bin/env node
/**
 * Is this course ready to be opened by real people?
 *
 * The dry run Ramy asked for before C4/2026 starts on 6 November 2026, made
 * repeatable. Every screen in Connect computes from the course's STRUCTURE --
 * its dates, its timetable, its groups, who is in them -- and a screen cannot
 * be better than the structure behind it. The stage harness proved that from
 * the other direction: move the course and the screens change. This asks the
 * same question ahead of time, on a real course, without touching a row.
 *
 * Strictly read-only. It runs against live centres and must stay that way.
 *
 *   node scripts/course-readiness.mjs                 # every real course
 *   node scripts/course-readiness.mjs --course C4/2026
 *
 * Exits non-zero if anything is a blocker.
 */

import fs from "node:fs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const weekday = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long" });
const isWeekend = (iso) => [0, 6].includes(new Date(`${iso}T00:00:00`).getDay());
/** Teaching days between two dates, Monday to Friday, inclusive. */
function weekdaysBetween(startIso, endIso) {
  let n = 0;
  const d = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  while (d <= end) { if (!isWeekend(d.toISOString().slice(0, 10))) n += 1; d.setDate(d.getDate() + 1); }
  return n;
}

const findings = [];
const blocker = (area, what, why, fix) => findings.push({ level: "blocker", area, what, why, fix });
const warn = (area, what, why, fix) => findings.push({ level: "warning", area, what, why, fix });
const note = (area, what, why, fix) => findings.push({ level: "note", area, what, why, fix });

async function check(course) {
  const id = course.id;
  const [{ data: centre }, { data: events }, { data: groups }, { data: subgroups }, { data: tutors }, { data: trainees }] =
    await Promise.all([
      db.from("centers").select("name, time_zone").eq("id", course.center_id).maybeSingle(),
      db.from("course_timetable_events").select("event_date, event_time, type, title, linked_tp_number").eq("course_id", id),
      db.from("course_tp_groups").select("id, name, tutor_profile_id").eq("course_id", id),
      db.from("course_subgroups").select("id, name, half_order, tp_group_id").eq("course_id", id),
      db.from("course_tutors").select("profile_id, tutor_role, left_at").eq("course_id", id),
      db.from("profiles").select("id, full_name, course_status, selected_for_assessor_visit").eq("course_id", id),
    ]);

  const subgroupIds = (subgroups ?? []).map((s) => s.id);
  const { data: members } = subgroupIds.length
    ? await db.from("course_subgroup_members").select("subgroup_id, trainee_id, base_slot").in("subgroup_id", subgroupIds)
    : { data: [] };
  const [{ data: plans }, { data: assignments }, { data: coursebooks }, { data: templates }] = await Promise.all([
    db.from("plan_assignments").select("trainee_id, tp_number, tp_point_id, taught_at").eq("course_id", id),
    db.from("assignments").select("trainee_id, assignment_type, due_date").eq("course_id", id),
    db.from("tp_coursebooks").select("id, title, storage_path").eq("center_id", course.center_id),
    db.from("assignment_templates").select("id, assignment_type").eq("center_id", course.center_id),
  ]);

  // ---------------------------------------------------------------- shape --
  if (!course.start_date || !course.end_date) {
    blocker("Shape", "no start or end date", "Every week label, day counter and deadline is derived from these.", "Set them on the course.");
  } else {
    const teachingDays = weekdaysBetween(course.start_date, course.end_date);
    if (weekday(course.start_date) !== "Monday") {
      blocker("Shape", `starts on a ${weekday(course.start_date)} (${course.start_date})`,
        "The timetable groups days into CALENDAR weeks, so a course that does not start on a Monday spans an extra week and renders a final week containing one or two days. Ramy hit exactly this on the demo course: \"it reads five weeks at the bottom, and it's the wrong date.\"",
        "Move the start to a Monday, or accept a short final week and check every week label reads sensibly.");
    }
    if (teachingDays !== 20) {
      warn("Shape", `${teachingDays} teaching days between the dates, not 20`,
        "A full CELTA is 20 timetabled days; \"Day N of 20\" and the week strip both count real days, so they will not read as 20.",
        "Check the dates. 20 weekdays is four full Monday-to-Friday weeks.");
    }
  }
  if (!centre?.time_zone) blocker("Shape", "centre has no time zone", "Every clock, deadline and day boundary needs it.", "Set centers.time_zone.");
  if (!course.time_bands) {
    note("Shape", "no custom time_bands", "Falls back to the default nine 45-minute bands, 10:00-18:00. Fine unless this centre's day differs.", "Set courses.time_bands if the real day is not 10:00-18:00.");
  }

  // ------------------------------------------------------------- timetable --
  const dates = [...new Set((events ?? []).map((e) => e.event_date))].sort();
  const tpEvents = (events ?? []).filter((e) => e.type === "tp");
  if ((events ?? []).length === 0) {
    blocker("Timetable", "no timetable at all", "Your Day, the day bar, the day counter and every \"what is on today\" answer come from this table.", "Build the timetable.");
  } else if (dates.length < 20) {
    blocker("Timetable", `only ${dates.length} distinct day(s) timetabled, and ${events.length} event(s)`,
      `A full day is around nine events; twenty days is roughly 140. "Day N of 20" counts DISTINCT TIMETABLED DATES, so it will read "of ${dates.length}".`,
      "Build the rest of the timetable before anyone signs in.");
  }
  const untimed = (events ?? []).filter((e) => !e.event_time && !["assignment_due", "resubmission_due"].includes(e.type));
  if (untimed.length > 0) {
    blocker("Timetable", `${untimed.length} session(s) have no time of day`,
      "A session with no event_time is skipped by the day track and the day bar entirely -- it exists in the database and appears nowhere on screen.",
      "Give every session a start time. Only deadlines are allowed to have none.");
  }
  const halves = new Set((subgroups ?? []).map((s) => s.half_order).filter(Boolean));
  if (halves.size > 1 && tpEvents.length > 0) {
    const tpDates = [...new Set(tpEvents.map((e) => e.event_date))].length;
    const rounds = new Set(tpEvents.map((e) => e.linked_tp_number).filter(Boolean)).size;
    if (rounds > 0 && tpDates < rounds * 2) {
      blocker("Timetable", `${rounds} TP round(s) across only ${tpDates} date(s), with ${halves.size} halves teaching`,
        "Each half teaches a round on its own day, so a paired course needs two dates per round. halfTpDates splits the dates alternately, so each half will be handed half the rounds and the rail will read \"TP4 of 4\" on an eight-TP course.",
        "Timetable each TP round twice -- one day per half.");
    }
  }

  // ---------------------------------------------------------------- people --
  const active = (trainees ?? []).filter((t) => t.course_status === "active");
  const inSubgroup = new Set((members ?? []).map((m) => m.trainee_id));
  const orphans = active.filter((t) => !inSubgroup.has(t.id));
  if (active.length === 0) blocker("People", "no active trainees", "Nothing to run.", "Enrol the cohort.");
  if (orphans.length > 0) {
    blocker("People", `${orphans.length} active trainee(s) in no TP subgroup: ${orphans.map((t) => t.full_name).join(", ")}`,
      "Without a subgroup and a half_order there is no teaching schedule to read, so their landing says \"Your teaching schedule isn't set up yet\" and the rail has no TP line at all.",
      "Put every trainee in a subgroup, or take them off the course.");
  }
  for (const g of subgroups ?? []) {
    if (!g.half_order) warn("People", `subgroup "${g.name}" has no half_order`, "The rotation reads half_order to work out which day this group teaches on.", "Set it to 1 or 2.");
    const slots = (members ?? []).filter((m) => m.subgroup_id === g.id).map((m) => m.base_slot);
    if (new Set(slots).size !== slots.length) {
      blocker("People", `subgroup "${g.name}" has duplicate base_slot values`, "base_slot is the rotation position; two people in the same slot means the rotation cannot say who teaches when.", "Give each member a distinct base_slot.");
    }
  }
  const roles = (tutors ?? []).filter((t) => !t.left_at).map((t) => t.tutor_role);
  if (!roles.includes("main_course_tutor")) blocker("People", "no current main course tutor", "The MCT is the authority behind readiness, grades and the assessor pack.", "Assign an MCT in course_tutors.");
  for (const t of tutors ?? []) {
    if (t.left_at && course.end_date && t.left_at.slice(0, 10) < course.end_date) {
      note("People", `a ${t.tutor_role.replace(/_/g, " ")} leaves on ${t.left_at.slice(0, 10)}, before the course ends`, "Intentional on a shared course, but they lose access from that date.", "Confirm this is meant.");
    }
  }
  const dupes = Object.entries(
    active.reduce((m, t) => ((m[t.full_name] = (m[t.full_name] ?? 0) + 1), m), {})
  ).filter(([, n]) => n > 1);
  for (const [name, n] of dupes) {
    warn("People", `${n} active trainees share the name "${name}"`, "Usually a duplicate or a test account left on a real course.", "Remove the duplicate, or rename if they are genuinely two people.");
  }

  // ------------------------------------------------------- teaching record --
  const taught = (plans ?? []).filter((p) => p.taught_at);
  const today = new Date().toISOString().slice(0, 10);
  if (course.start_date > today && taught.length > 0) {
    blocker("Teaching record", `${taught.length} lesson(s) already marked taught on a course that starts ${course.start_date}`,
      "The landing reads taught_at to decide what to say. Every one of these trainees will be told \"All your TPs are taught\" on day one.",
      "Clear the taught_at values left over from testing.");
  }
  if ((plans ?? []).length > 0 && (plans ?? []).every((p) => !p.tp_point_id)) {
    warn("Teaching record", "no lesson is linked to a TP library point",
      "CELTA 5 Section 6 traces the LEVEL taught through plan_assignments.tp_point_id -> tp_points -> tp_coursebooks.level. With none, it reports zero levels against a Cambridge requirement of two.",
      "Assign lessons from the library, or set tp_point_id on the existing rows.");
  }

  // ---------------------------------------------------------- assignments --
  const perTrainee = active.length > 0 ? (assignments ?? []).length / active.length : 0;
  if (active.length > 0 && (assignments ?? []).length < active.length * 4) {
    warn("Assignments", `${(assignments ?? []).length} assignment rows for ${active.length} trainees (${perTrainee.toFixed(1)} each, expected 4)`,
      "A missing row is an assignment the trainee cannot see or submit.",
      "Generate the four Cambridge assignments for everyone.");
  }
  const noDue = (assignments ?? []).filter((a) => !a.due_date);
  if (noDue.length > 0) {
    warn("Assignments", `${noDue.length} assignment(s) with no due date`, "Catch up and the rail's deadline line both key off due_date; with none, nothing is ever chased.", "Set the deadlines.");
  }
  const templateTypes = new Set((templates ?? []).map((t) => t.assignment_type));
  for (const type of ["Focus on Learner", "LRT", "Skills", "LfC"]) {
    if (!templateTypes.has(type)) warn("Assignments", `no brief for ${type} at this centre`, "The brief page is what tells a trainee what the assignment asks for.", "Upload or write the brief.");
  }

  // -------------------------------------------------------------- assessor --
  const flagged = active.filter((t) => t.selected_for_assessor_visit);
  if (flagged.length === active.length && active.length > 0) {
    warn("Assessor", `all ${active.length} candidates are flagged for the assessor visit`,
      "The pack is meant to be a SAMPLE the centre chooses. Flagged for everyone, the assessor is handed the whole cohort.",
      "Choose the sample on the roster.");
  }
  if (!course.assessor_visit_date) {
    note("Assessor", "no assessor visit date", "The pack's \"On the day\" panel and the lesson-plans page have no day to draw from.", "Set it once Cambridge confirms.");
  } else {
    const onDay = tpEvents.filter((e) => e.event_date === course.assessor_visit_date);
    if (onDay.length === 0) {
      warn("Assessor", `the visit (${course.assessor_visit_date}, a ${weekday(course.assessor_visit_date)}) has no teaching practice timetabled`,
        "The Handbook puts the visit on a day with TP to observe; the pack's lesson-plans page draws from that day's plans and will be empty.",
        "Move the visit to a TP day, or timetable TP on it.");
    }
  }

  // --------------------------------------------------------------- library --
  if ((coursebooks ?? []).length === 0) {
    warn("Library", "the centre has no TP coursebooks", "The TP library is what lessons are assigned from, and where CELTA 5 reads levels.", "Upload at least one coursebook.");
  }
  const ghosts = (coursebooks ?? []).filter((c) => c.storage_path && !c.storage_path.startsWith("demo:") && !c.storage_path.startsWith("system:"));
  if (ghosts.length > 0) {
    const bucket = db.storage.from("coursebook-pdfs");
    for (const c of ghosts) {
      const dir = c.storage_path.split("/").slice(0, -1).join("/");
      const file = c.storage_path.split("/").pop();
      const { data: listed } = await bucket.list(dir, { search: file });
      if (!(listed ?? []).some((f) => f.name === file)) {
        warn("Library", `coursebook "${c.title}" points at a file that is not in storage`, "Regeneration and any download from it will fail.", "Re-upload the source, or remove the row.");
      }
    }
  }
}

// ------------------------------------------------------------------- main ---
const wanted = arg("course");
let query = db.from("courses").select("*, centers!inner(is_demo)").eq("centers.is_demo", false);
if (wanted) query = query.eq("name", wanted);
const { data: courses, error } = await query;
if (error) { console.error(error.message); process.exit(1); }
if (!courses?.length) { console.error(wanted ? `No real course named "${wanted}".` : "No real courses."); process.exit(1); }

let blockers = 0;
for (const course of courses) {
  findings.length = 0;
  await check(course);
  console.log(`\n${"=".repeat(72)}\n${course.name}   ${course.start_date} -> ${course.end_date}\n${"=".repeat(72)}`);
  if (findings.length === 0) { console.log("\nReady. Nothing to fix.\n"); continue; }
  const order = { blocker: 0, warning: 1, note: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level] || a.area.localeCompare(b.area));
  for (const f of findings) {
    const mark = f.level === "blocker" ? "BLOCKER" : f.level === "warning" ? "warning" : "note   ";
    console.log(`\n${mark}  [${f.area}] ${f.what}`);
    console.log(`         ${f.why}`);
    console.log(`         -> ${f.fix}`);
  }
  const n = findings.filter((f) => f.level === "blocker").length;
  blockers += n;
  console.log(`\n${findings.length} finding(s), ${n} blocking.\n`);
}
process.exit(blockers > 0 ? 1 : 0);
