// A private walkthrough course, cloned out of the running demo.
//
// Ramy, 12 Sep 2026: he wants to walk a whole TP cycle himself -- write the
// plan as the candidate, submit it, pick it up as the tutor, mark it, release
// the feedback -- and the demo centre cannot be used for that: a trigger
// (block_demo_center_writes) refuses every write from a logged-in demo
// account, on purpose, so a visitor cannot alter the shared demo.
//
// So this deep-copies the demo course into Elmswood English Centre, which is
// a real non-demo centre with no courses in it. Same dates, same twelve
// candidates, same timetable, same history -- but writable, and invisible to
// anyone opening the demo.
//
// Two things are deliberately NOT copied as they stand:
//
//   1. The tutor swap. Handbook 10.2 puts Stage 2 at the point "when
//      candidates are swapping tutors/TP groups", and the ported timetable
//      says "Level & tutor change" at TP5 -- but the demo had one tutor per
//      group for the whole course, and every one of Amara's six feedbacks was
//      written by the MCT even though her group's tutor is the ACT. Here the
//      swap is real: Group A is Marcus's for TP1-4 and Jordan's from TP5,
//      Group B the other way round. course_tp_groups.tutor_profile_id holds
//      the CURRENT (post-swap) tutor, which is what the app reads.
//
//   2. Nothing demo-only: access tokens, join tokens, the assessor's issued
//      link. The walkthrough course issues its own.
//
// Re-runnable: it deletes a previous walkthrough course at Elmswood first.
//
//   node scripts/clone-walkthrough-course.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const DEMO_COURSE_ID = "6d7fbc3a-3362-4fe1-aa23-befd98e2c59b";
const ELMSWOOD_ID = "c2086317-68ac-4bbf-9ac5-3e3b25a1b4b1"; // resolved below by name, this is a fallback
const COURSE_NAME = "CELTA Walkthrough (Ramy)";
const EMAIL_PREFIX = "walk-";

/** Every FK column this script has to point at a copied row. */
const REMAP = {
  course_id: "course",
  center_id: "center",
  trainee_id: "profile",
  trainer_id: "profile",
  created_by: "profile",
  author_id: "profile",
  issued_by: "profile",
  marker_id: "profile",
  second_marker_id: "profile",
  profile_id: "profile",
  tutor_profile_id: "profile",
  supervisor_profile_id: "profile",
  visible_to_trainee_id: "profile",
  cambridge_grades_confirmed_by: "profile",
  grade_form_submitted_by: "profile",
  grade_approval_form_submitted_by: "profile",
  stage2_moved_earlier_by: "profile",
  stage3_moved_earlier_by: "profile",
  admin_access_granted_by: "profile",
  assignment_fail_override_by: "profile",
  tp_group_id: "tp_group",
  tp_group_scope_id: "tp_group",
  visible_to_tp_group_id: "tp_group",
  subgroup_id: "subgroup",
  visible_to_subgroup_id: "subgroup",
  timetable_event_id: "event",
  anchor_event_id: "event",
  linked_live_session_event_id: "event",
  tp_plan_id: "tp_plan",
  plan_id: "tp_plan",
  assignment_id: "assignment",
  related_assignment_id: "assignment",
  block_id: "stage2_block",
  tp_coursebook_id: "coursebook",
  tp_point_id: "tp_point",
  volunteer_student_id: "volunteer",
};

/** Columns never carried over: identity, timestamps the DB owns, demo-only secrets. */
const DROP = new Set([
  "id",
  "created_at",
  "updated_at",
  "trainee_join_token",
  "trainer_join_token",
  "duplicated_from_course_id",
]);

const maps = {
  course: new Map(),
  center: new Map(),
  profile: new Map(),
  tp_group: new Map(),
  subgroup: new Map(),
  event: new Map(),
  tp_plan: new Map(),
  assignment: new Map(),
  stage2_block: new Map(),
  coursebook: new Map(),
  tp_point: new Map(),
  volunteer: new Map(),
};

/**
 * Columns that may simply be blanked when they point at somebody the clone
 * did not copy (a centre admin who is not on the course, say). Anything else
 * unmappable means the row itself belongs to someone outside this course, and
 * the row is skipped rather than mangled -- course_tutors carries exactly such
 * a row on the demo.
 */
const NULLABLE_FK = new Set([
  "created_by",
  "author_id",
  "issued_by",
  "trainer_id",
  "marker_id",
  "second_marker_id",
  "supervisor_profile_id",
  "tutor_profile_id",
  "visible_to_trainee_id",
  "visible_to_tp_group_id",
  "visible_to_subgroup_id",
  "cambridge_grades_confirmed_by",
  "grade_form_submitted_by",
  "grade_approval_form_submitted_by",
  "stage2_moved_earlier_by",
  "stage3_moved_earlier_by",
  "admin_access_granted_by",
  "assignment_fail_override_by",
  "anchor_event_id",
  "linked_live_session_event_id",
  "related_assignment_id",
  "tp_point_id",
  "tp_coursebook_id",
  "volunteer_student_id",
]);
const SKIP = Symbol("skip");

function remapRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (DROP.has(k)) continue;
    const kind = REMAP[k];
    if (!kind || typeof v !== "string") {
      out[k] = v;
      continue;
    }
    if (maps[kind].has(v)) out[k] = maps[kind].get(v);
    else if (NULLABLE_FK.has(k)) out[k] = null;
    else return SKIP;
  }
  return out;
}

async function copyTable(table, rows, { mapKind = null, patch = null } = {}) {
  if (!rows || rows.length === 0) return [];
  const kept = [];
  const payload = [];
  for (const r of rows) {
    const mapped = remapRow(r);
    if (mapped === SKIP) continue;
    kept.push(r);
    payload.push(patch ? patch(mapped, r) : mapped);
  }
  if (payload.length === 0) return [];
  if (kept.length !== rows.length) console.log(`  ${table}: skipped ${rows.length - kept.length} row(s) belonging outside this course`);
  rows = kept;
  const { data, error } = await supabase.from(table).insert(payload).select("id");
  if (error) throw new Error(`${table}: ${error.message}`);
  if (mapKind) rows.forEach((r, i) => maps[mapKind].set(r.id, data[i].id));
  console.log(`  ${table}: ${data.length}`);
  return data;
}

const pick = (t, q) => supabase.from(t).select("*").match(q);

async function main() {
  // --- Where it lands -------------------------------------------------
  const { data: elmswood } = await supabase.from("centers").select("id, name, time_zone").eq("name", "Elmswood English Centre").maybeSingle();
  if (!elmswood) throw new Error("Elmswood English Centre not found");
  const { data: demoCourse } = await supabase.from("courses").select("*").eq("id", DEMO_COURSE_ID).single();
  maps.center.set(demoCourse.center_id, elmswood.id);
  console.log(`Cloning "${demoCourse.name}" into ${elmswood.name}`);

  // --- Clear a previous run -------------------------------------------
  const { data: old } = await supabase.from("courses").select("id").eq("center_id", elmswood.id).eq("name", COURSE_NAME);
  for (const c of old ?? []) {
    const { data: people } = await supabase.from("profiles").select("id").eq("course_id", c.id);
    for (const p of people ?? []) {
      await supabase.from("profiles").delete().eq("id", p.id);
      await supabase.auth.admin.deleteUser(p.id).catch(() => {});
    }
    await supabase.from("courses").delete().eq("id", c.id);
    console.log(`  removed a previous walkthrough course (${c.id.slice(0, 8)})`);
  }

  // --- The course ------------------------------------------------------
  const courseRow = remapRow(demoCourse);
  courseRow.name = COURSE_NAME;
  courseRow.center_id = elmswood.id;
  const { data: newCourse, error: cErr } = await supabase.from("courses").insert(courseRow).select("id").single();
  if (cErr) throw new Error(`courses: ${cErr.message}`);
  maps.course.set(DEMO_COURSE_ID, newCourse.id);
  console.log(`  course: ${newCourse.id}`);

  // --- Coursebooks (centre-scoped, so Elmswood needs its own) ----------
  const { data: demoBooks } = await supabase.from("tp_coursebooks").select("*").eq("center_id", demoCourse.center_id);
  await copyTable("tp_coursebooks", demoBooks ?? [], { mapKind: "coursebook" });
  const bookIds = (demoBooks ?? []).map((b) => b.id);
  if (bookIds.length) {
    const { data: demoPoints } = await supabase.from("tp_points").select("*").in("tp_coursebook_id", bookIds);
    await copyTable("tp_points", demoPoints ?? [], { mapKind: "tp_point" });
  }

  // --- People ----------------------------------------------------------
  const { data: demoPeople } = await supabase.from("profiles").select("*").eq("course_id", DEMO_COURSE_ID).order("role");
  for (const person of demoPeople ?? []) {
    const email = `${EMAIL_PREFIX}${person.email.replace(/^demo-/, "")}`;
    const { data: authUser, error: aErr } = await supabase.auth.admin.createUser({ email, email_confirm: true });
    if (aErr) throw new Error(`auth ${email}: ${aErr.message}`);
    const row = remapRow(person);
    row.id = authUser.user.id;
    row.email = email;
    row.center_id = elmswood.id;
    row.course_id = newCourse.id;
    const { error: pErr } = await supabase.from("profiles").insert(row);
    if (pErr) throw new Error(`profiles ${email}: ${pErr.message}`);
    maps.profile.set(person.id, authUser.user.id);
  }
  console.log(`  profiles: ${(demoPeople ?? []).length}`);

  // --- Structure -------------------------------------------------------
  const { data: tutors } = await pick("course_tutors", { course_id: DEMO_COURSE_ID });
  await copyTable("course_tutors", tutors);

  const { data: groups } = await pick("course_tp_groups", { course_id: DEMO_COURSE_ID });
  await copyTable("course_tp_groups", groups, { mapKind: "tp_group" });

  const { data: subgroups } = await pick("course_subgroups", { course_id: DEMO_COURSE_ID });
  await copyTable("course_subgroups", subgroups, { mapKind: "subgroup" });

  const subIds = (subgroups ?? []).map((s) => s.id);
  const { data: members } = subIds.length ? await supabase.from("course_subgroup_members").select("*").in("subgroup_id", subIds) : { data: [] };
  await copyTable("course_subgroup_members", members);

  const { data: schedule } = await pick("course_tp_schedule", { course_id: DEMO_COURSE_ID });
  await copyTable("course_tp_schedule", schedule);

  const { data: events } = await pick("course_timetable_events", { course_id: DEMO_COURSE_ID });
  await copyTable("course_timetable_events", events, { mapKind: "event" });

  // --- The candidates' work -------------------------------------------
  const { data: planAssignments } = await pick("plan_assignments", { course_id: DEMO_COURSE_ID });
  await copyTable("plan_assignments", planAssignments);

  const traineeIds = (demoPeople ?? []).filter((p) => p.role === "trainee").map((p) => p.id);
  const byTrainee = async (t) => (traineeIds.length ? (await supabase.from(t).select("*").in("trainee_id", traineeIds)).data : []);

  const plans = await byTrainee("tp_plans");
  await copyTable("tp_plans", plans, { mapKind: "tp_plan" });
  await copyTable("tp_self_evaluations", await byTrainee("tp_self_evaluations"));

  // Feedback carries the tutor swap: TP1-4 the group's first-half tutor,
  // TP5-8 the other one. In the demo every feedback was the MCT's.
  const groupByTrainee = new Map();
  for (const m of members ?? []) {
    const sg = (subgroups ?? []).find((s) => s.id === m.subgroup_id);
    if (sg) groupByTrainee.set(m.trainee_id, sg.tp_group_id);
  }
  const groupA = (groups ?? []).find((g) => g.name === "Group A");
  const groupB = (groups ?? []).find((g) => g.name === "Group B");
  const mct = (demoPeople ?? []).find((p) => p.tutor_role === "main_course_tutor");
  const act = (demoPeople ?? []).find((p) => p.tutor_role === "assistant_course_tutor" && p.full_name === "Marcus Webb");
  const firstHalfTutor = (groupId) => (groupId === groupA?.id ? act?.id : mct?.id);
  const secondHalfTutor = (groupId) => (groupId === groupA?.id ? mct?.id : act?.id);

  await copyTable("tp_feedback", await byTrainee("tp_feedback"), {
    patch: (mapped, original) => {
      const groupId = groupByTrainee.get(original.trainee_id);
      const owner = original.tp_number <= 4 ? firstHalfTutor(groupId) : secondHalfTutor(groupId);
      if (owner && maps.profile.has(owner)) mapped.trainer_id = maps.profile.get(owner);
      return mapped;
    },
  });
  await copyTable("tp_lessons", await byTrainee("tp_lessons"), {
    patch: (mapped, original) => {
      const groupId = groupByTrainee.get(original.trainee_id);
      const owner = original.tp_number <= 4 ? firstHalfTutor(groupId) : secondHalfTutor(groupId);
      if (owner && maps.profile.has(owner)) mapped.trainer_id = maps.profile.get(owner);
      return mapped;
    },
  });
  await copyTable("observations", await byTrainee("observations"));

  // --- Written assignments ---------------------------------------------
  const assignments = await byTrainee("assignments");
  await copyTable("assignments", assignments, { mapKind: "assignment" });
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: sections } = assignmentIds.length
    ? await supabase.from("assignment_section_responses").select("*").in("assignment_id", assignmentIds)
    : { data: [] };
  await copyTable("assignment_section_responses", sections);

  // --- The CELTA 5 ------------------------------------------------------
  await copyTable("celta5_records", await pick("celta5_records", { course_id: DEMO_COURSE_ID }).then((r) => r.data));
  await copyTable("celta5_matrix", await pick("celta5_matrix", { course_id: DEMO_COURSE_ID }).then((r) => r.data));

  // --- Tutorials, letters, volunteers, announcements --------------------
  const { data: blocks } = await pick("stage2_tutorial_blocks", { course_id: DEMO_COURSE_ID });
  await copyTable("stage2_tutorial_blocks", blocks, { mapKind: "stage2_block" });
  const blockIds = (blocks ?? []).map((b) => b.id);
  const { data: slots } = blockIds.length ? await supabase.from("stage2_tutorial_slots").select("*").in("block_id", blockIds) : { data: [] };
  await copyTable("stage2_tutorial_slots", slots);

  await copyTable("individual_tutorial_invites", await pick("individual_tutorial_invites", { course_id: DEMO_COURSE_ID }).then((r) => r.data));
  await copyTable("formal_letters", await pick("formal_letters", { course_id: DEMO_COURSE_ID }).then((r) => r.data));
  await copyTable("volunteer_students", await pick("volunteer_students", { course_id: DEMO_COURSE_ID }).then((r) => r.data), { mapKind: "volunteer" });
  await copyTable("course_broadcasts", await pick("course_broadcasts", { course_id: DEMO_COURSE_ID }).then((r) => r.data));

  // --- The tutor swap, on the groups themselves -------------------------
  // The course is past TP5, so the CURRENT tutor of each group is the
  // second-half one. This is what every "your group" view reads.
  if (groupA && groupB && mct && act) {
    await supabase.from("course_tp_groups").update({ tutor_profile_id: maps.profile.get(mct.id) }).eq("id", maps.tp_group.get(groupA.id));
    await supabase.from("course_tp_groups").update({ tutor_profile_id: maps.profile.get(act.id) }).eq("id", maps.tp_group.get(groupB.id));
    console.log("  tutor swap: Group A -> the MCT, Group B -> the ACT (second half)");
  }

  // --- Amara's TP8 is the walk, so it starts clean ----------------------
  const amara = (demoPeople ?? []).find((p) => p.full_name === "Amara Okafor");
  if (amara) {
    const newAmara = maps.profile.get(amara.id);
    await supabase.from("tp_plans").delete().eq("trainee_id", newAmara).eq("tp_number", 8);
    await supabase.from("tp_feedback").delete().eq("trainee_id", newAmara).eq("tp_number", 8);
    await supabase.from("tp_self_evaluations").delete().eq("trainee_id", newAmara).eq("tp_number", 8);
    console.log("  Amara's TP8 left empty, ready to write");
  }

  console.log("\nDone. Course:", newCourse.id);
  const { data: check } = await supabase.from("profiles").select("full_name, email, role").eq("course_id", newCourse.id).order("role");
  for (const p of check ?? []) console.log(`  ${p.role.padEnd(8)} ${p.full_name.padEnd(18)} ${p.email}`);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
