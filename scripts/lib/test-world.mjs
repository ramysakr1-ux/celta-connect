// A throwaway course with real people on it, and the means to take it away.
//
// Shared by write-paths.mjs and journeys.mjs so there is ONE definition of what
// a test world is. Two copies would drift, and a fixture that quietly differs
// between two harnesses is a fixture neither of them is really testing against.
//
// It builds on a NON-DEMO centre on purpose. Migration 0079 blocks every
// authenticated write on a demo centre, so the demo course cannot be used to
// test anything that writes -- which is most of what a person does.
//
// Everything it creates uses @example.com, so purge-course.mjs would accept it
// and nothing left behind can be mistaken for a real cohort. tearDown() runs in
// a finally block; call it even when the run fails.

import fs from "node:fs";

export function env() {
  return Object.fromEntries(
    fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
}

export async function buildWorld({ admin }) {
  const stamp = Date.now();

  // Sweep anything a previous run left behind. An early crash here -- before
  // the teardown existed -- stranded three auth accounts with no profile
  // attached, invisible to every profiles-based check. seed-demo.mjs sweeps by
  // email prefix for exactly this reason; so does this.
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of existing?.users ?? []) {
    if (!/^(tw|wpt)-.*@example\.com$/.test(u.email ?? "")) continue;
    const { data: stillHasProfile } = await admin.from("profiles").select("id").eq("id", u.id).maybeSingle();
    if (!stillHasProfile) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }

  const seed = async (table, row) => {
    const { data, error } = await admin.from(table).insert(row).select("id").single();
    if (error) throw new Error(`seed ${table}: ${error.message}`);
    return data;
  };

  const centre = await seed("centers", {
    name: `Test World ${stamp}`, center_number: `TW-${stamp}`, is_demo: false, time_zone: "Europe/Istanbul",
  });
  const course = await seed("courses", {
    center_id: centre.id, name: `TW ${stamp}`, start_date: "2026-09-07", end_date: "2026-10-02",
    total_hours: 120, delivery_mode: "f2f",
  });

  const mkUser = async (slug, role, name) => {
    const email = `tw-${slug}-${stamp}@example.com`;
    const { data: u, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    // INSERT: creating an auth user does not create a profile, there is no
    // trigger. And profiles_course_required_for_trainer_trainee means a
    // trainer needs a course too, not just a trainee.
    const { error: pErr } = await admin.from("profiles").insert({
      id: u.user.id, email, full_name: name, role, center_id: centre.id, course_id: course.id,
    });
    if (pErr) throw new Error(`profile ${email}: ${pErr.message}`);
    return { id: u.user.id, email, name };
  };

  const trainee = await mkUser("trainee", "trainee", "Test Trainee");
  const trainer = await mkUser("trainer", "trainer", "Test Trainer");
  await admin.from("course_tutors").insert({ course_id: course.id, profile_id: trainer.id, tutor_role: "main_course_tutor" });

  const group = await seed("course_tp_groups", { course_id: course.id, name: "Group A", tutor_profile_id: trainer.id });
  const subgroup = await seed("course_subgroups", { course_id: course.id, name: "Group A -- Half A", tp_group_id: group.id, half_order: 1 });
  await seed("course_subgroup_members", { subgroup_id: subgroup.id, trainee_id: trainee.id, base_slot: 0 });

  const plan = await seed("plan_assignments", {
    course_id: course.id, trainee_id: trainee.id, tp_number: 1,
    main_lesson_aim: "Present perfect for life experience", density_tier: "scripted", assigned_by: trainer.id,
  });
  const assignment = await seed("assignments", {
    course_id: course.id, trainee_id: trainee.id, assignment_type: "Focus on Learner", first_status: "not_submitted",
  });
  // The brief is what the assignment page renders its sections from. Without
  // one the page has no fields to fill and a journey test has nothing to type
  // into -- which reads as a broken form rather than a missing fixture.
  await seed("assignment_templates", {
    center_id: centre.id, assignment_type: "Focus on Learner", storage_path: "system:focus-on-learner",
    generation_status: "completed", published_at: new Date().toISOString(),
    sections: [
      { key: "learner_profile", title: "Learner profile", instruction: "Describe your chosen learner." },
      { key: "needs_analysis", title: "Needs analysis", instruction: "What evidence did you gather?" },
    ],
  });
  const broadcast = await seed("course_broadcasts", {
    course_id: course.id, title: "Test notice", body: "Body", author_id: trainer.id, sent_at: new Date().toISOString(),
  });

  return { stamp, centreId: centre.id, courseId: course.id, trainee, trainer, planId: plan.id, assignmentId: assignment.id, broadcastId: broadcast.id, subgroupId: subgroup.id };
}

/** A real signed-in session, the same two steps /auth/confirm performs. */
export async function magicLinkUrl({ admin, email, next, baseUrl }) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const u = new URL("/auth/confirm", baseUrl);
  u.searchParams.set("token_hash", data.properties.hashed_token);
  u.searchParams.set("type", "magiclink");
  u.searchParams.set("next", next);
  return u.toString();
}

export async function tearDown({ admin, world }) {
  if (!world) return;
  const quietly = async (fn) => { try { await fn(); } catch { /* teardown never masks a result */ } };
  const BY_TRAINEE = ["tp_self_evaluations", "course_broadcast_reads", "course_subgroup_members", "assignment_responses"];
  const BY_COURSE = ["tp_feedback", "tp_plans", "plan_assignments", "assignments", "course_broadcasts", "course_subgroups", "course_tp_groups", "course_tutors"];
  if (world.trainee) for (const t of BY_TRAINEE) await quietly(() => admin.from(t).delete().eq("trainee_id", world.trainee.id));
  for (const t of BY_COURSE) await quietly(() => admin.from(t).delete().eq("course_id", world.courseId));
  await quietly(() => admin.from("assignment_templates").delete().eq("center_id", world.centreId));
  await quietly(() => admin.from("courses").delete().eq("id", world.courseId));
  for (const p of [world.trainee, world.trainer]) if (p) await quietly(() => admin.auth.admin.deleteUser(p.id));
  await quietly(() => admin.from("centers").delete().eq("id", world.centreId));
}
