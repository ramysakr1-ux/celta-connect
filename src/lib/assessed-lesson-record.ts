import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StandardRating } from "@/lib/supabase/types";
import { halfTpDates } from "@/lib/rotation";
import { resolveTimeBands, bandIndexFor } from "@/lib/timetable-grid";
import { CEFR_LEVELS, extractLevelCode } from "@/lib/levels";

/**
 * The CELTA 5 "Record of assessed teaching practice" row, filled from the
 * feedback the tutor has just submitted.
 *
 * The CELTA 5 tells the candidate: "complete the following table each time
 * you teach. All the information you need is to be found on the lesson
 * feedback sheets your tutor gives you" -- date, length, level, number of
 * learners, lesson focus, tutor assessment. Until 12 Sep 2026 Connect had
 * that table (tp_lessons) as a second, separate form the tutor filled by
 * hand after writing the feedback: the same facts typed twice, and nothing
 * stopping "above standard" on the feedback sheet from sitting next to "to
 * standard" on the record. The feedback IS the source, so the record is
 * written from it: date and length from the timetable, level from the TP
 * schedule, focus from the plan, assessment and comment from the feedback.
 *
 * A tutor's own entry is never overwritten: date, length, level and learner
 * count are filled only where empty (the learner count is theirs alone --
 * nothing in the record knows who turned up). The assessment and the focus
 * follow the feedback, because a record that disagrees with the feedback
 * sheet it claims to summarise is the one thing an assessor checks first.
 */
export async function recordAssessedLesson(
  supabase: SupabaseClient<Database>,
  input: {
    courseId: string;
    traineeId: string;
    tpNumber: number;
    planId: string;
    trainerId: string;
    grade: StandardRating | null;
    overallComment: string | null;
  }
): Promise<void> {
  const [{ data: plan }, { data: membership }, { data: course }, { data: existing }] = await Promise.all([
    supabase.from("tp_plans").select("main_aims").eq("id", input.planId).maybeSingle(),
    supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", input.traineeId).maybeSingle(),
    supabase.from("courses").select("time_bands").eq("id", input.courseId).maybeSingle(),
    supabase.from("tp_lessons").select("id, lesson_date, length_minutes, level, learner_count, lesson_focus, tutor_comments").eq("trainee_id", input.traineeId).eq("tp_number", input.tpNumber).maybeSingle(),
  ]);

  // The day and the length: this candidate's day-set owns every other
  // distinct TP date, and the Nth of those is TP N -- the same arithmetic
  // the rotation and the assessor's lesson-plans page use.
  let lessonDate: string | null = null;
  let lengthMinutes: number | null = null;
  let level: string | null = null;
  const { data: subgroup } = membership
    ? await supabase.from("course_subgroups").select("half_order, tp_group_id").eq("id", membership.subgroup_id).maybeSingle()
    : { data: null };
  if (subgroup?.half_order) {
    const { data: tpEvents } = await supabase
      .from("course_timetable_events")
      .select("event_date, event_time, tp_group_scope_id")
      .eq("course_id", input.courseId)
      .eq("type", "tp");
    const scoped = (tpEvents ?? []).filter((e) => !e.tp_group_scope_id || e.tp_group_scope_id === subgroup.tp_group_id);
    lessonDate = halfTpDates(scoped, subgroup.half_order)[input.tpNumber - 1] ?? null;
    if (lessonDate) {
      const bands = resolveTimeBands(course?.time_bands ?? null);
      const firstThatDay = scoped.filter((e) => e.event_date === lessonDate && e.event_time).map((e) => e.event_time!).sort()[0] ?? null;
      const band = bands[bandIndexFor(firstThatDay, bands)] ?? bands[0];
      const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      lengthMinutes = band ? toMin(band.end) - toMin(band.start) : null;
    }
    if (subgroup.tp_group_id) {
      const { data: sched } = await supabase
        .from("course_tp_schedule")
        .select("tp_coursebooks(level)")
        .eq("tp_group_id", subgroup.tp_group_id)
        .eq("tp_number", input.tpNumber)
        .maybeSingle();
      const raw = (sched?.tp_coursebooks as unknown as { level?: string } | null)?.level ?? null;
      if (raw) {
        const code = extractLevelCode(raw);
        const known = CEFR_LEVELS.find((l) => l.code === code);
        level = known ? `${known.name} (${known.code})` : raw;
      }
    }
  }

  const row = {
    course_id: input.courseId,
    trainee_id: input.traineeId,
    tp_number: input.tpNumber,
    trainer_id: input.trainerId,
    lesson_date: existing?.lesson_date ?? lessonDate,
    length_minutes: existing?.length_minutes ?? lengthMinutes,
    level: existing?.level ?? level,
    learner_count: existing?.learner_count ?? null,
    lesson_focus: plan?.main_aims ?? existing?.lesson_focus ?? null,
    tutor_assessment: input.grade,
    tutor_comments: input.overallComment ?? existing?.tutor_comments ?? null,
  };
  const { error } = existing
    ? await supabase.from("tp_lessons").update(row).eq("id", existing.id)
    : await supabase.from("tp_lessons").insert(row);
  // The feedback itself is already saved; a record that could not be written
  // is worth seeing in the logs, not worth failing the tutor's submission.
  if (error) console.error("[assessed-lesson-record]", error);
}
