#!/usr/bin/env node
/**
 * Does writing actually work?
 *
 * The smoke test only READS. Every form, every submission, every save in
 * Connect -- around a hundred files of server actions -- had no coverage of
 * any kind, and that is the half of the app a pilot walks through. Ramy,
 * 10 Sep 2026, on the bugs: "when are they gonna stop?" They stop being
 * surprises when nothing is left unexercised, and this was the biggest thing
 * left.
 *
 * It cannot call the server actions themselves: Next 15 hands them out as
 * encrypted action refs, so they cannot be POSTed to without a real browser,
 * and their bodies need a Next request context to run at all. What it CAN do
 * is everything underneath -- sign in as a real user and make the same writes
 * those actions make, with RLS on, against real policies, real constraints and
 * real triggers. That is where "submitting does nothing" actually lives: a
 * missing policy, a SECURITY DEFINER function that moved, a NOT NULL nobody
 * fills. The action's own guard clauses are covered separately.
 *
 * It builds its own world and takes it away again:
 *
 *   - A NON-DEMO centre, because migration 0079 blocks every authenticated
 *     write on a demo one -- the demo course cannot test writing at all.
 *   - Its people use @example.com, so purge-course.mjs would accept them and
 *     nothing here can be mistaken for a real cohort.
 *   - Torn down in a finally block, pass or fail.
 *
 *   node scripts/write-paths.mjs
 */

// The world is built by scripts/lib/test-world.mjs, shared with journeys.mjs.
// It used to be built here, inline, and a second copy of a fixture is a fixture
// the two harnesses stop agreeing about.
import { buildWorld, tearDown, env } from "./lib/test-world.mjs";

const E = env();
const { createClient } = await import("@supabase/supabase-js");
const URL_ = E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, E.SUPABASE_SERVICE_ROLE_KEY);

const stamp = Date.now();
const results = [];
const ok = (name, detail = "") => results.push({ pass: true, name, detail });
const bad = (name, why) => results.push({ pass: false, name, why });

/** Sign in for real: mint a magic link, redeem it, keep the access token. The
 *  same two steps /auth/confirm performs, so the session is a genuine one. */
async function signIn(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const anon = createClient(URL_, ANON);
  const { data: sess, error: vErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (vErr) throw new Error(`verifyOtp: ${vErr.message}`);
  return createClient(URL_, ANON, {
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let world = null;
try {
  world = await buildWorld({ admin });
  const { courseId: course, trainee, trainer, planId, assignmentId, broadcastId } = world;
  const traineeId = trainee.id;
  const trainerId = trainer.id;
  const plan = { id: planId };
  const assignment = { id: assignmentId };
  const broadcast = { id: broadcastId };

  const asTrainee = await signIn(trainee.email);
  const asTrainer = await signIn(trainer.email);

  // ------------------------------------------------------- trainee writes --
  {
    const { data, error } = await asTrainee.from("tp_plans").insert({
      course_id: course, trainee_id: traineeId, tp_number: 1, plan_assignment_id: plan.id,
      main_aims: "Learners will use the present perfect.", anticipated_problems: [], procedure: [],
    }).select("id").single();
    if (error) bad("trainee writes a TP plan draft", error.message);
    else {
      ok("trainee writes a TP plan draft");
      const { error: uErr } = await asTrainee.from("tp_plans").update({ main_aims: "Edited by the trainee." }).eq("id", data.id);
      uErr ? bad("trainee edits their unsubmitted plan", uErr.message) : ok("trainee edits their unsubmitted plan");
      // Self-evaluation needs the lesson taught, which is the trainer's move.
      await admin.from("plan_assignments").update({ taught_at: new Date().toISOString() }).eq("id", plan.id);
      const { error: sErr } = await asTrainee.from("tp_self_evaluations").insert({
        tp_plan_id: data.id, trainee_id: traineeId, tp_number: 1, what_went_well: "Timing held.", action_points: [],
      });
      sErr ? bad("trainee writes a self-evaluation", sErr.message) : ok("trainee writes a self-evaluation");
    }
  }
  {
    const { error } = await asTrainee.from("course_broadcast_reads").insert({ broadcast_id: broadcast.id, trainee_id: traineeId });
    error ? bad("trainee marks a notice read (migration 0283)", error.message) : ok("trainee marks a notice read (migration 0283)");
  }
  {
    const { error } = await asTrainee.rpc("submit_assignment_round", {
      p_assignment_id: assignment.id, p_word_count: 900, p_ai_declared: false, p_ai_conversation_url: null, p_own_work_confirmed: true,
    });
    if (error) bad("trainee submits an assignment (submit_assignment_round)", error.message);
    else {
      const { data: after } = await admin.from("assignments").select("first_status, first_submitted_at").eq("id", assignment.id).maybeSingle();
      after?.first_status === "submitted" && after?.first_submitted_at
        ? ok("trainee submits an assignment", `status now "${after.first_status}"`)
        : bad("trainee submits an assignment", `the call succeeded but first_status is "${after?.first_status}" -- the write did not land`);
    }
  }
  {
    const { error } = await asTrainee.rpc("save_syllabus_planning_entry", {
      p_tp_number: 7, p_main_aim: "Giving advice", p_sub_aim: "Speaking", p_material: "Roadmap A2 p.55", p_aim_type: "grammar",
    });
    error ? bad("trainee chooses their own TP7 topic", error.message) : ok("trainee chooses their own TP7 topic");
  }

  // ------------------------------------------------------- trainer writes --
  {
    // tp_feedback hangs off the PLAN, not the course -- there is no course_id
    // on it, which is also how the demo write-blocker has to reach the centre
    // through tp_plan_id rather than directly.
    const { data: tp } = await admin.from("tp_plans").select("id").eq("trainee_id", traineeId).limit(1).maybeSingle();
    const { error } = await asTrainer.from("tp_feedback").insert({
      tp_plan_id: tp?.id, trainee_id: traineeId, tp_number: 1, trainer_id: trainerId, grade: "to_standard",
      strengths_planning: [], action_points_planning: [], strengths_teaching: [], action_points_teaching: [],
      overall_comment: "Solid.", submitted_at: new Date().toISOString(),
    });
    error ? bad("trainer writes TP feedback", error.message) : ok("trainer writes TP feedback");
  }
  {
    const { error } = await asTrainer.from("course_broadcasts").insert({
      course_id: course, title: "From the tutor", body: "Reading for tomorrow.", author_id: trainerId, sent_at: new Date().toISOString(),
    });
    error ? bad("trainer posts a notice", error.message) : ok("trainer posts a notice");
  }
  {
    const { error } = await asTrainer.from("plan_assignments").update({ main_lesson_aim: "Reassigned" }).eq("id", plan.id);
    error ? bad("trainer reassigns a lesson", error.message) : ok("trainer reassigns a lesson");
  }

  // ------------------------------------------------------ what must FAIL --
  // A test that only proves writes succeed proves half of nothing.
  {
    const { data: other } = await admin.from("profiles").select("id").eq("role", "trainee").neq("id", traineeId).limit(1).maybeSingle();
    if (other) {
      const { data: rows } = await asTrainee.from("tp_plans").update({ main_aims: "not mine" }).eq("trainee_id", other.id).select("id");
      (rows ?? []).length === 0 ? ok("trainee CANNOT edit someone else's plan") : bad("trainee CANNOT edit someone else's plan", `${rows.length} row(s) changed`);
    }
  }
  {
    // The demo block, asked properly. The first version of this had a
    // NON-demo trainee marking a DEMO broadcast as read and expected a
    // refusal -- but block_demo_center_writes resolves the centre from the
    // first reference column it finds, and course_broadcast_reads carries
    // trainee_id, so the row was correctly judged to belong to the reader's
    // own centre. The write going through was right; the test was wrong.
    //
    // The real question is whether a DEMO user can change demo data, which is
    // what the read-only demo promises every visitor.
    try {
      const asDemoTrainee = await signIn("demo-amara@celtaconnect.com");
      // The SIGNED-IN id, from the token. Reading `profiles` and taking the
      // first row gave a groupmate instead -- a trainee can see the others on
      // their course -- so the insert failed RLS (trainee_id <> auth.uid())
      // before the demo trigger ever got a look at it. Refused for the wrong
      // reason is not a pass.
      const { data: who } = await asDemoTrainee.auth.getUser();
      const { data: me } = await asDemoTrainee.from("profiles").select("id, course_id").eq("id", who.user.id).maybeSingle();
      const { data: b } = await admin.from("course_broadcasts").select("id").eq("course_id", me?.course_id).limit(1).maybeSingle();
      if (!b) {
        bad("demo stays read-only (migration 0079)", "no demo broadcast to try -- re-run npm run seed:demo");
      } else {
        // Clear any existing read row first, as the service role, which the
        // trigger deliberately lets through. Otherwise the primary key refuses
        // the insert before the demo block ever sees it -- and "refused for the
        // wrong reason" is how this test passed while the demo was writable.
        await admin.from("course_broadcast_reads").delete().eq("broadcast_id", b.id).eq("trainee_id", me.id);
        const { error } = await asDemoTrainee.from("course_broadcast_reads").insert({ broadcast_id: b.id, trainee_id: me.id });
        error && /shared demo/i.test(error.message)
          ? ok("demo stays read-only (migration 0079)", "refused, as promised")
          : bad("demo stays read-only (migration 0079)", error ? `refused for the WRONG reason: ${error.message}` : "the write went through");
      }
    } catch (e) {
      bad("demo stays read-only (migration 0079)", e.message);
    }
  }
} catch (e) {
  bad("harness", e.message);
} finally {
  await tearDown({ admin, world });
}

console.log("\nWRITE PATHS\n");
for (const r of results) {
  console.log(r.pass ? `  ok    ${r.name}${r.detail ? `  (${r.detail})` : ""}` : `  FAIL  ${r.name}\n          ${r.why}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} of ${results.length} passed.\n`);
process.exit(failed.length > 0 ? 1 : 0);
