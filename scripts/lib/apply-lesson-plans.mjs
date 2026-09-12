// Fills every seeded lesson plan with a real one (see lesson-plans-demo.mjs).
//
// Only ever UPDATES rows that already exist -- it never creates a plan, so a
// deliberately empty one (the TP a walkthrough starts on) stays empty.
//
// Shared by seed-demo.mjs and the one-off apply-to-production run, so the two
// cannot tell different stories.

import { buildPlan } from "./lesson-plans-demo.mjs";

export async function applyLessonPlans(supabase, courseId) {
  const [{ data: plans }, { data: planAssignments }, { data: feedback }] = await Promise.all([
    supabase.from("tp_plans").select("id, trainee_id, tp_number, main_aims, procedure").eq("course_id", courseId),
    supabase.from("plan_assignments").select("trainee_id, tp_number, main_lesson_aim, tp_point_id").eq("course_id", courseId),
    supabase.from("tp_feedback").select("trainee_id, tp_number, action_points_teaching").eq("course_id", courseId),
  ]);
  if (!plans || plans.length === 0) return { updated: 0, skipped: 0 };

  // Level per lesson: plan_assignment -> tp_point -> coursebook -> level.
  const pointIds = [...new Set((planAssignments ?? []).map((p) => p.tp_point_id).filter(Boolean))];
  const { data: points } = pointIds.length
    ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", pointIds)
    : { data: [] };
  const bookIds = [...new Set((points ?? []).map((p) => p.tp_coursebook_id).filter(Boolean))];
  const { data: books } = bookIds.length ? await supabase.from("tp_coursebooks").select("id, level").in("id", bookIds) : { data: [] };
  const bookById = new Map((books ?? []).map((b) => [b.id, b.level]));
  const pointBook = new Map((points ?? []).map((p) => [p.id, p.tp_coursebook_id]));

  const briefFor = new Map();
  const levelFor = new Map();
  for (const pa of planAssignments ?? []) {
    const key = `${pa.trainee_id}:${pa.tp_number}`;
    briefFor.set(key, pa.main_lesson_aim);
    const book = pa.tp_point_id ? pointBook.get(pa.tp_point_id) : null;
    levelFor.set(key, book ? bookById.get(book) : null);
  }
  const actionPointsFor = new Map();
  for (const f of feedback ?? []) {
    const points = Array.isArray(f.action_points_teaching) ? f.action_points_teaching.map((p) => p?.text).filter(Boolean) : [];
    actionPointsFor.set(`${f.trainee_id}:${f.tp_number}`, points);
  }

  let updated = 0;
  let skipped = 0;
  for (const plan of plans) {
    const key = `${plan.trainee_id}:${plan.tp_number}`;
    const brief = briefFor.get(key);
    if (!brief) {
      skipped += 1;
      continue;
    }
    const built = buildPlan({
      brief,
      tpNumber: plan.tp_number,
      level: levelFor.get(key) ?? "B1+",
      learnerCount: 12,
      previousActionPoints: actionPointsFor.get(`${plan.trainee_id}:${plan.tp_number - 1}`) ?? [],
    });
    const { error } = await supabase.from("tp_plans").update(built).eq("id", plan.id);
    if (error) throw new Error(`tp_plans ${plan.id}: ${error.message}`);
    updated += 1;
  }
  return { updated, skipped };
}
