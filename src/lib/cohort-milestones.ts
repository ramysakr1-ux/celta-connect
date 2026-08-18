import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// design_handoff_announcements' "morale" messages -- four course-wide
// broadcasts fired once a real milestone is reached by EVERY active
// trainee, not on a date. Different shape from the rest of
// announcements-catalog.ts: those anchor to a single timetable event:
// offset pair, these anchor to a cohort-completion condition, so they're
// checked from the action that could complete that condition (a taught
// lesson, a filed Stage 1 report, a recorded final grade) rather than a
// single anchor row. Same idempotency pattern as generateStandardAnnouncements
// (source_key, checked before insert) -- fires once per course, ever.
async function activeTraineeIds(supabase: SupabaseClient<Database>, courseId: string): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .eq("course_status", "active");
  return (data ?? []).map((r) => r.id);
}

async function alreadyFired(supabase: SupabaseClient<Database>, courseId: string, sourceKey: string): Promise<boolean> {
  const { data } = await supabase
    .from("course_broadcasts")
    .select("id")
    .eq("course_id", courseId)
    .eq("source_key", sourceKey)
    .maybeSingle();
  return !!data;
}

async function fireCohortMessage(
  supabase: SupabaseClient<Database>,
  courseId: string,
  authorId: string,
  sourceKey: string,
  title: string,
  body: string
): Promise<void> {
  if (await alreadyFired(supabase, courseId, sourceKey)) return;
  await supabase.from("course_broadcasts").insert({
    course_id: courseId,
    author_id: authorId,
    title,
    body,
    sent_at: new Date().toISOString(),
    source_key: sourceKey,
  });
}

const TWO_LESSONS_IN_BODY =
  "Everyone has now taught twice, and everyone got through it. That is worth saying plainly, because week one of a CELTA does not feel like an achievement while you are inside it.\n\n" +
  "What you have done so far was heavily supported -- the materials were given to you and the shape of the lesson was decided. From here that changes: you write your own aims and you make your own choices. It will feel harder because it is harder, and that is the course working rather than going wrong.\n\n" +
  "If anything about the next stage is unclear, ask at consultation rather than at 11pm.";

const STAGE1_RECORDS_BODY =
  "Your Stage 1 record is on your file now. It is a snapshot of where you are after four lessons -- not a grade, not a prediction, and not something Cambridge sees.\n\n" +
  "Most of you will find it says roughly what your tutor has already said in feedback. If it says something that surprises you, that is exactly what the record is for, and your tutor would rather talk about it this week than in week five.\n\n" +
  "Nobody is behind for having things to work on at this point. Everybody has things to work on at this point.\n\n" +
  "Read it, then bring any questions to your tutor.";

const HARD_PART_BODY =
  "This is where most people find it heaviest. You are far enough in that the novelty has gone, you have an assignment out and one coming back, and the teaching is no longer supported.\n\n" +
  "Almost everyone on this course is quietly assuming they are the only one struggling. They are not -- this is the shape of the course at this point, not the shape of you.\n\n" +
  "Two practical things. Sleep is more useful than another hour on a lesson plan. And if you are behind on your file, tell somebody now rather than sorting it out in the final week.\n\n" +
  "We have run this course many times. It always feels like this here, and it always passes.";

const COURSE_END_BODY =
  "You have taught eight lessons at two levels, written four assignments, and been observed and given feedback on every one of them.\n\n" +
  "Your recommended grade goes to Cambridge with your portfolio. Grades are provisional until Cambridge confirms them, and certificates usually arrive within about three months -- we will email you when yours is issued.\n\n" +
  "You each have a written explanation of your grade on your file, whether or not you asked for one. It sets out what your record shows and what would have made a difference. It is worth reading in a week, when you are less tired.\n\n" +
  "Keep in touch -- we write references, and we would rather write them for people we have heard from.";

// Called after a taught_at write for tp_number 2 or 5. Cheap to call for
// every TP -- the tpNumber check below makes it a no-op for the other six.
export async function checkTaughtMilestones(
  supabase: SupabaseClient<Database>,
  courseId: string,
  authorId: string,
  tpNumber: number
): Promise<void> {
  if (tpNumber !== 2 && tpNumber !== 5) return;

  const sourceKey = tpNumber === 2 ? "morale:two_lessons_in" : "morale:hard_part";
  if (await alreadyFired(supabase, courseId, sourceKey)) return;

  const traineeIds = await activeTraineeIds(supabase, courseId);
  if (traineeIds.length === 0) return;

  const { data: taughtRows } = await supabase
    .from("plan_assignments")
    .select("trainee_id")
    .eq("tp_number", tpNumber)
    .in("trainee_id", traineeIds)
    .not("taught_at", "is", null);
  const taughtTraineeIds = new Set((taughtRows ?? []).map((r) => r.trainee_id));
  const everyoneTaught = traineeIds.every((id) => taughtTraineeIds.has(id));
  if (!everyoneTaught) return;

  if (tpNumber === 2) {
    await fireCohortMessage(supabase, courseId, authorId, sourceKey, "Two lessons in", TWO_LESSONS_IN_BODY);
  } else {
    await fireCohortMessage(supabase, courseId, authorId, sourceKey, "This is the hard part", HARD_PART_BODY);
  }
}

// Called after a stage1_completed_at write.
export async function checkStage1RecordsMilestone(
  supabase: SupabaseClient<Database>,
  courseId: string,
  authorId: string
): Promise<void> {
  const sourceKey = "morale:stage1_records";
  if (await alreadyFired(supabase, courseId, sourceKey)) return;

  const traineeIds = await activeTraineeIds(supabase, courseId);
  if (traineeIds.length === 0) return;

  const { data: records } = await supabase
    .from("celta5_records")
    .select("trainee_id, stage1_completed_at")
    .in("trainee_id", traineeIds);
  const filedTraineeIds = new Set((records ?? []).filter((r) => r.stage1_completed_at).map((r) => r.trainee_id));
  const everyoneFiled = traineeIds.every((id) => filedTraineeIds.has(id));
  if (!everyoneFiled) return;

  await fireCohortMessage(supabase, courseId, authorId, sourceKey, "Your first progress record", STAGE1_RECORDS_BODY);
}

// Called after a final_recommended_grade write -- "the final day, after the
// grade meeting" is every candidate's grade being recorded, not a date
// check: in practice the grade meeting happens at/near the course's actual
// final day, so the completion condition alone is the right trigger.
export async function checkFinalGradeMilestone(
  supabase: SupabaseClient<Database>,
  courseId: string,
  authorId: string
): Promise<void> {
  const sourceKey = "morale:course_end";
  if (await alreadyFired(supabase, courseId, sourceKey)) return;

  const traineeIds = await activeTraineeIds(supabase, courseId);
  if (traineeIds.length === 0) return;

  const { data: records } = await supabase
    .from("celta5_records")
    .select("trainee_id, final_recommended_grade")
    .in("trainee_id", traineeIds);
  const gradedTraineeIds = new Set((records ?? []).filter((r) => r.final_recommended_grade).map((r) => r.trainee_id));
  const everyoneGraded = traineeIds.every((id) => gradedTraineeIds.has(id));
  if (!everyoneGraded) return;

  await fireCohortMessage(supabase, courseId, authorId, sourceKey, "That is the course", COURSE_END_BODY);
}
