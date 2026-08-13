// Seeds (or resets) the public read-only demo centre -- build-spec.md §1
// build order #21 "Demo -- a flagged clone of the real app." Safe to
// re-run any time: deletes the existing demo centre (if any) and its
// cascading data first, then rebuilds it fresh. Uses the service-role key,
// which connects as `service_role`, not `authenticated` -- the write-
// blocking trigger from migration 0079 only fires for `authenticated`
// sessions, so this script is never blocked by the very protection it's
// setting up.
//
// Run with: node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // --- Clean slate ---
  const { data: existing } = await supabase.from("centers").select("id").eq("is_demo", true).maybeSingle();
  if (existing) {
    const { data: oldTrainees } = await supabase.from("profiles").select("id").eq("center_id", existing.id);
    for (const t of oldTrainees ?? []) {
      await supabase.auth.admin.deleteUser(t.id).catch(() => {});
    }
    await supabase.from("centers").delete().eq("id", existing.id);
    console.log("Removed previous demo centre.");
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
    .insert({ name: "Connect CELTA Demo Centre", center_number: "DEMO", is_demo: true })
    .select("id")
    .single();
  if (centerErr) throw centerErr;
  console.log("centre:", center.id);

  // --- Course: 4 weeks, currently in week 3, reads as a live running course ---
  const startDate = isoDaysFromNow(-14);
  const endDate = isoDaysFromNow(14);
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .insert({
      center_id: center.id,
      name: "CELTA Demo Course",
      start_date: startDate,
      end_date: endDate,
      total_hours: 120,
      delivery_mode: "f2f",
    })
    .select("id")
    .single();
  if (courseErr) throw courseErr;
  console.log("course:", course.id);

  // --- Trainer ---
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
  console.log("trainer:", trainerId);

  // --- Trainees, varied depth ---
  const traineeDefs = [
    { name: "Amara Okafor", email: "demo-amara@celtaconnect.com" },
    { name: "Daniel Kim", email: "demo-daniel@celtaconnect.com" },
    { name: "Priya Sharma", email: "demo-priya@celtaconnect.com" },
  ];
  const trainees = {};
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
      course_status: "active",
    });
    if (traineeProfileErr) throw traineeProfileErr;
    trainees[def.name] = authUser.user.id;
  }
  console.log("trainees:", trainees);

  // --- TP feedback helper ---
  async function seedTaughtTp(traineeId, tpNumber, { aim, grade, strengths, actionPoints, daysAgo }) {
    await supabase.from("plan_assignments").insert({
      course_id: course.id,
      trainee_id: traineeId,
      tp_number: tpNumber,
      main_lesson_aim: aim,
      density_tier: tpNumber <= 2 ? "scripted" : tpNumber <= 4 ? "framework" : "minimal",
      assigned_by: trainerId,
      taught_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    });
    const { data: plan } = await supabase
      .from("tp_plans")
      .insert({
        course_id: course.id,
        trainee_id: traineeId,
        tp_number: tpNumber,
        main_aims: aim,
        submitted_at: new Date(Date.now() - (daysAgo + 1) * 86400000).toISOString(),
      })
      .select("id")
      .single();
    await supabase.from("tp_self_evaluations").insert({
      tp_plan_id: plan.id,
      trainee_id: traineeId,
      tp_number: tpNumber,
      what_went_well: "The lead-in got strong engagement and the timing worked well.",
      what_not_as_planned: "Ran short on freer practice time.",
      submitted_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    });
    await supabase.from("tp_feedback").insert({
      tp_plan_id: plan.id,
      trainee_id: traineeId,
      tp_number: tpNumber,
      trainer_id: trainerId,
      grade,
      strengths_planning: strengths.map((s) => ({ text: s, starred: false, criteria_codes: [] })),
      action_points_planning: actionPoints.map((s) => ({ text: s, starred: false, criteria_codes: [] })),
      strengths_teaching: strengths.map((s) => ({ text: s, starred: false, criteria_codes: [] })),
      action_points_teaching: actionPoints.map((s) => ({ text: s, starred: false, criteria_codes: [] })),
      overall_comment: "A confident, well-paced lesson overall -- keep building on this.",
      submitted_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    });
  }

  // Amara: strong, 4 TPs taught
  for (const [i, cfg] of [
    { aim: "Present perfect for life experience", grade: "above_standard", days: 12 },
    { aim: "Reading for gist and detail: a city life article", grade: "to_standard", days: 9 },
    { aim: "Vocabulary: Air Travel", grade: "above_standard", days: 6 },
    { aim: "Functional language: Making suggestions", grade: "to_standard", days: 3 },
  ].entries()) {
    await seedTaughtTp(trainees["Amara Okafor"], i + 1, {
      aim: cfg.aim,
      grade: cfg.grade,
      strengths: ["Clear instructions", "Good rapport with learners", "Effective concept checking"],
      actionPoints: ["Vary interaction patterns a little more"],
      daysAgo: cfg.days,
    });
  }
  await supabase.from("celta5_records").insert({
    course_id: course.id,
    trainee_id: trainees["Amara Okafor"],
    hours_attended: 24,
    provisional_grade: "Pass B",
  });
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
      final_grade: "pass",
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
      final_grade: "pass",
    },
  ]);

  // Daniel: average, 2 TPs, one resubmission in progress, a recurring action point (at-risk)
  for (const [i, cfg] of [
    { aim: "Grammar: First conditional", grade: "to_standard", days: 10 },
    { aim: "Listening for gist: a podcast about moving abroad", grade: "not_to_standard", days: 4 },
  ].entries()) {
    await seedTaughtTp(trainees["Daniel Kim"], i + 1, {
      aim: cfg.aim,
      grade: cfg.grade,
      strengths: ["Good board work"],
      actionPoints: ["Instructions need to be more concise and checked", "Monitor more actively during pair work"],
      daysAgo: cfg.days,
    });
  }
  await supabase.from("celta5_records").insert({
    course_id: course.id,
    trainee_id: trainees["Daniel Kim"],
    hours_attended: 12,
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

  // Priya: early-stage, 1 TP taught
  await seedTaughtTp(trainees["Priya Sharma"], 1, {
    aim: "Reading for gist and detail: a workplace article",
    grade: "to_standard",
    strengths: ["Warm, confident classroom presence"],
    actionPoints: ["Give clearer time limits on tasks"],
    daysAgo: 2,
  });
  await supabase.from("celta5_records").insert({
    course_id: course.id,
    trainee_id: trainees["Priya Sharma"],
    hours_attended: 6,
  });

  // --- Timetable ---
  const events = [
    { type: "input_session", title: "Introduction to CELTA & Learner Needs", offset: -14 },
    { type: "tp", title: "TP1", offset: -12 },
    { type: "input_session", title: "Language Analysis Workshop", offset: -11 },
    { type: "tp", title: "TP2", offset: -9 },
    { type: "assignment_due", title: "Focus on Learner due", offset: -10, linked: "Focus on Learner" },
    { type: "tp", title: "TP3", offset: -6 },
    { type: "input_session", title: "Receptive Skills Methodology", offset: -5 },
    { type: "assignment_due", title: "LRT due", offset: -5, linked: "LRT" },
    { type: "tp", title: "TP4", offset: -3 },
    { type: "tp", title: "TP5", offset: 2 },
    { type: "input_session", title: "Teaching Vocabulary", offset: 5 },
    { type: "tp", title: "TP6", offset: 7 },
  ];
  await supabase.from("course_timetable_events").insert(
    events.map((e) => ({
      course_id: course.id,
      type: e.type,
      title: e.title,
      event_date: isoDaysFromNow(e.offset),
      linked_assignment_type: e.linked ?? null,
      created_by: trainerId,
    }))
  );

  console.log("DEMO SEED COMPLETE");
  console.log("center_id=" + center.id);
  console.log("course_id=" + course.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
