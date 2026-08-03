import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { TpLessonForm } from "@/app/dashboard/trainer/trainees/[id]/tp-lesson-form";
import { AssignmentForm } from "@/app/dashboard/trainer/trainees/[id]/assignment-form";
import { StandardRatingPill } from "@/lib/status-pill";
import { getTpCardStatus } from "@/lib/tp-plan-content";

export default async function TraineeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!trainee || trainee.course_id !== trainer.course_id || trainee.role !== "trainee") {
    notFound();
  }

  const [{ data: lessons }, { data: assignments }, { data: plans }, { data: tpPlans }, { data: selfEvaluations }, { data: feedbackRows }] =
    await Promise.all([
      supabase
        .from("tp_lessons")
        .select("*")
        .eq("trainee_id", id)
        .order("lesson_date", { ascending: false, nullsFirst: false }),
      supabase.from("assignments").select("*").eq("trainee_id", id).order("assignment_type"),
      supabase.from("plan_assignments").select("tp_number, taught_at").eq("trainee_id", id),
      supabase.from("tp_plans").select("tp_number, submitted_at").eq("trainee_id", id),
      supabase.from("tp_self_evaluations").select("tp_number, submitted_at").eq("trainee_id", id),
      supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", id),
    ]);

  const assignedTpNumbers = new Set((plans ?? []).map((p) => p.tp_number));
  const taughtByTpNumber = new Map((plans ?? []).map((p) => [p.tp_number, Boolean(p.taught_at)]));
  const tpPlanByNumber = new Map((tpPlans ?? []).map((p) => [p.tp_number, p]));
  const selfEvalByTpNumber = new Map((selfEvaluations ?? []).map((s) => [s.tp_number, s]));
  const feedbackByTpNumber = new Map((feedbackRows ?? []).map((f) => [f.tp_number, f]));

  const loggedTpNumbers = new Set(
    (lessons ?? []).map((l) => l.tp_number).filter((n): n is number => n !== null)
  );
  const suggestedTpNumber =
    (plans ?? [])
      .map((p) => p.tp_number)
      .filter((n) => !loggedTpNumbers.has(n))
      .sort((a, b) => a - b)[0] ?? null;

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: tags } =
    lessonIds.length > 0
      ? await supabase.from("tp_lesson_criteria_tags").select("*").in("tp_lesson_id", lessonIds)
      : { data: [] };
  const tagsByLesson = new Map<string, typeof tags>();
  for (const tag of tags ?? []) {
    const list = tagsByLesson.get(tag.tp_lesson_id) ?? [];
    list.push(tag);
    tagsByLesson.set(tag.tp_lesson_id, list);
  }

  const totalMinutes = (lessons ?? []).reduce((sum, l) => sum + (l.length_minutes ?? 0), 0);
  const levels = new Set((lessons ?? []).map((l) => l.level).filter(Boolean));

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">{trainee.full_name}</h1>
          <p className="mt-1 text-muted">{trainee.email}</p>
        </div>
        <Link
          href={`/dashboard/trainer/trainees/${id}/celta5`}
          className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          CELTA 5 record
        </Link>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Assignments</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assignments?.map((assignment) => (
            <AssignmentForm
              key={`${assignment.id}-${assignment.updated_at}`}
              assignment={assignment}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">TP cards</h2>
        <p className="mt-1 text-sm text-muted">Lesson plan, language analysis, materials, self-evaluation and feedback for each TP.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
            if (!assignedTpNumbers.has(n)) {
              return (
                <div key={n} className="card p-4 text-sm text-muted">
                  TP{n} -- not assigned
                </div>
              );
            }
            const feedback = feedbackByTpNumber.get(n);
            const status = getTpCardStatus({
              planSubmitted: Boolean(tpPlanByNumber.get(n)?.submitted_at),
              taught: Boolean(taughtByTpNumber.get(n)),
              selfEvalSubmitted: Boolean(selfEvalByTpNumber.get(n)?.submitted_at),
              feedbackSubmitted: Boolean(feedback?.submitted_at),
              grade: feedback?.grade,
            });
            return (
              <Link key={n} href={`/dashboard/trainer/trainees/${id}/tp/${n}`} className="card-interactive p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-ink">TP{n}</p>
                  {feedback?.submitted_at && feedback.grade ? <StandardRatingPill rating={feedback.grade} /> : null}
                </div>
                <p
                  className={`text-sm ${
                    status.tone === "on-track"
                      ? "text-primary"
                      : status.tone === "at-risk"
                        ? "text-destructive"
                        : "text-muted"
                  }`}
                >
                  {status.label}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Teaching Practice</h2>
        <p className="mt-1 text-sm text-muted">
          {(totalMinutes / 60).toFixed(1)} hours taught across {levels.size} level
          {levels.size === 1 ? "" : "s"} (6 hours across 2+ levels required).
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {lessons?.map((lesson) => (
            <TpLessonForm
              key={`${lesson.id}-${lesson.updated_at}`}
              traineeId={id}
              lesson={lesson}
              tags={tagsByLesson.get(lesson.id) ?? []}
            />
          ))}
          <TpLessonForm traineeId={id} suggestedTpNumber={suggestedTpNumber} />
        </div>
      </div>
    </div>
  );
}
