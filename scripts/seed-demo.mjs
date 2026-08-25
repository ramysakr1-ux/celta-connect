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

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // --- Clean slate ---
  const { data: existing } = await supabase.from("centers").select("id").eq("is_demo", true).maybeSingle();
  if (existing) {
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
    await supabase.from("profiles").delete().eq("center_id", existing.id);

    // 0156_centre_hard_delete.sql is the same function the real "Delete
    // this centre" admin flow uses -- reused here rather than a raw
    // `centers.delete()` because it already knows about every FK in the
    // graph that doesn't cascade (restart_transfers/deferral_transfers/
    // course_close_outs), not just the profiles one this script handles
    // above.
    const { error: hardDeleteErr } = await supabase.rpc("centre_hard_delete", { p_center_id: existing.id });
    if (hardDeleteErr) throw hardDeleteErr;
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

  // --- Course: 4 weeks, currently in week 3, reads as a live running course.
  // accepting_applications stays true even mid-course -- nobody has closed
  // intake yet, which is what gives the admissions pipeline / payments demo
  // (below) a live course to attach applicants to. ---
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
      accepting_applications: true,
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
    full_name: "Layla Fenn",
    role: "admin",
    center_id: center.id,
  });
  await supabase.from("centre_roles").insert({
    profile_id: centreAdminId,
    center_id: center.id,
    role: "centre_owner",
  });
  console.log("centre admin:", centreAdminId);

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

  // --- TP feedback helper -- returns the tp_plans.id so callers can attach
  // shared materials to a specific plan. ---
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
    return plan.id;
  }

  // Amara: strong, 4 TPs taught
  const amaraTpPlanIds = []; // index 0 = TP1, ... -- every TP gets several
  // shared materials below, not one apiece (Ramy, 25 Aug 2026, pointing at
  // Volunteer View.dc.html's own "3 handouts"/"2 handouts" rows: "I'm
  // talking about the actual materials where they lie inside the cards").
  for (const [i, cfg] of [
    { aim: "Present perfect for life experience", grade: "above_standard", days: 12, materialNames: ["Present perfect -- slides", "Present perfect -- gap-fill handout"] },
    { aim: "Reading for gist and detail: a city life article", grade: "to_standard", days: 9, materialNames: ["City life reading text", "Reading for gist -- comprehension questions"] },
    { aim: "Vocabulary: Air Travel", grade: "above_standard", days: 6, materialNames: ["Air Travel vocabulary -- flashcards", "Air Travel -- listening transcript", "Air Travel -- matching worksheet"] },
    { aim: "Functional language: Making suggestions", grade: "to_standard", days: 3, materialNames: ["Making suggestions -- slides", "Making suggestions -- role-play cards"] },
  ].entries()) {
    const planId = await seedTaughtTp(trainees["Amara Okafor"], i + 1, {
      aim: cfg.aim,
      grade: cfg.grade,
      strengths: ["Clear instructions", "Good rapport with learners", "Effective concept checking"],
      actionPoints: ["Vary interaction patterns a little more"],
      daysAgo: cfg.days,
    });
    amaraTpPlanIds.push({ planId, materialNames: cfg.materialNames });
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

  // --- Timetable (capture ids: TP events feed the volunteer demo below) ---
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
    // Real Zoom link (not test data) -- volunteer-view-full-spec.md's own
    // mockup pairs a room with a Join online button on the featured next
    // class, so the demo's own next TP needs one too, not just an
    // in-person-only example.
    { type: "tp", title: "TP6", offset: 7, zoomUrl: "https://zoom.us/j/5551234567" },
  ];
  const { data: timetableRows } = await supabase
    .from("course_timetable_events")
    .insert(
      events.map((e) => ({
        course_id: course.id,
        type: e.type,
        title: e.title,
        event_date: isoDaysFromNow(e.offset),
        linked_assignment_type: e.linked ?? null,
        zoom_url: e.zoomUrl ?? null,
        // Real trainer-facing timetable events link a TP calendar day to its
        // rotation number (course_timetable_events.linked_tp_number) so the
        // volunteer view and portfolio pages can resolve a topic/materials
        // for that day via plan_assignments/tp_plans.tp_number -- these demo
        // "TPn"-titled events never carried that link, so every downstream
        // lookup silently found nothing (caught 25 Aug 2026 comparing the
        // volunteer view demo against its own design mockup).
        linked_tp_number: e.type === "tp" ? Number(e.title.replace("TP", "")) : null,
        created_by: trainerId,
      }))
    )
    .select("id, title");
  const tpEventIdByTitle = new Map((timetableRows ?? []).filter((r) => r.title.startsWith("TP")).map((r) => [r.title, r.id]));

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
  const pastTpTitles = ["TP1", "TP2", "TP3"];
  const attendanceRows = pastTpTitles
    .map((t) => tpEventIdByTitle.get(t))
    .filter(Boolean)
    .map((eventId) => ({ volunteer_student_id: volunteer.id, timetable_event_id: eventId }));
  if (attendanceRows.length > 0) {
    await supabase.from("volunteer_attendance").insert(attendanceRows);
  }
  // Several shared materials off every one of Amara's TPs, not one apiece --
  // volunteer-view-full-spec.md's own mockup shows a real handout COUNT
  // (2-3, not always 1) on every attended/missed row, and Ramy caught the
  // gap directly: "every TP should have the material so the students can
  // access them."
  for (const { planId, materialNames } of amaraTpPlanIds) {
    for (const materialName of materialNames) {
      const { data: material } = await supabase
        .from("tp_materials")
        .insert({
          tp_plan_id: planId,
          trainee_id: trainees["Amara Okafor"],
          file_name: materialName,
          slides_url: "https://docs.google.com/presentation/d/demo-placeholder/edit",
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

  console.log("DEMO SEED COMPLETE");
  console.log("center_id=" + center.id);
  console.log("course_id=" + course.id);
  console.log("past_course_id=" + pastCourse.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
