import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { StandardRatingPill } from "@/lib/status-pill";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { getTpCardStatus } from "@/lib/tp-plan-content";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// Trainee-facing view of TP1-8: every slot is always visible (so a trainee
// can see the shape of the course from day one), but a slot with no
// plan_assignments row yet renders as a bare locked box -- the assigned
// content itself still only reveals one TP at a time, via the trainer's
// taught-gate (assign_tp_round, migration 0017). Once a trainer logs the
// lesson's outcome (tp_lessons.tp_number, migration 0018), the same box also
// shows the outcome underneath the plan. Read-only throughout for TP1-6:
// trainees have no insert/update/delete policy on plan_assignments or
// tp_lessons. TP7/8 are the one exception -- trainees self-select their own
// topic via the syllabus planning grid (migration 0025) rather than waiting
// on a trainer, so an empty TP7/8 slot links there instead of just sitting
// locked.
export default async function TraineePlanPage() {
  const profile = await requireRole("trainee");
  const supabase = await createClient();

  const [{ data: plans }, { data: lessons }, { data: tpPlans }, { data: selfEvaluations }, { data: feedbackRows }] =
    await Promise.all([
      supabase.from("plan_assignments").select("*").eq("trainee_id", profile.id),
      supabase
        .from("tp_lessons")
        .select("*")
        .eq("trainee_id", profile.id)
        .not("tp_number", "is", null),
      supabase.from("tp_plans").select("tp_number, submitted_at").eq("trainee_id", profile.id),
      supabase.from("tp_self_evaluations").select("tp_number, submitted_at").eq("trainee_id", profile.id),
      supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", profile.id),
    ]);

  const planByTpNumber = new Map((plans ?? []).map((p) => [p.tp_number, p]));
  const lessonByTpNumber = new Map(
    (lessons ?? []).map((l) => [l.tp_number as number, l])
  );
  const tpPlanByTpNumber = new Map((tpPlans ?? []).map((p) => [p.tp_number, p]));
  const selfEvalByTpNumber = new Map((selfEvaluations ?? []).map((s) => [s.tp_number, s]));
  const feedbackByTpNumber = new Map((feedbackRows ?? []).map((f) => [f.tp_number, f]));

  const trainerIds = [...new Set((lessons ?? []).map((l) => l.trainer_id).filter(Boolean))];
  const { data: trainers } =
    trainerIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", trainerIds as string[])
      : { data: [] };
  const trainerNameById = new Map((trainers ?? []).map((t) => [t.id, t.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">Your lesson plans</h1>
          <p className="mt-2 text-muted">
            The teaching practice content your trainer has assigned you. Each plan gives you a
            little less scaffolding than the last -- by the end of the course you&apos;ll be
            planning from aims and materials alone.
          </p>
        </div>
        <Link
          href="/dashboard/trainee"
          className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TP_NUMBERS.map((tpNumber) => {
          const plan = planByTpNumber.get(tpNumber);

          if (!plan) {
            if (tpNumber === 7 || tpNumber === 8) {
              return (
                <Link
                  key={tpNumber}
                  href="/dashboard/trainee/plan/syllabus-grid"
                  className="card-interactive flex items-center gap-3 p-4"
                >
                  <span aria-hidden="true" className="text-lg text-muted">
                    ✏️
                  </span>
                  <div>
                    <h2 className="font-serif text-lg text-ink">TP{tpNumber}</h2>
                    <p className="text-sm text-muted">Choose your own topic in the syllabus planning grid.</p>
                  </div>
                </Link>
              );
            }
            return (
              <div key={tpNumber} className="card flex items-center gap-3 p-4">
                <span aria-hidden="true" className="text-lg text-muted">
                  🔒
                </span>
                <div>
                  <h2 className="font-serif text-lg text-muted">TP{tpNumber}</h2>
                  <p className="text-sm text-muted">
                    Not yet assigned -- your trainer will unlock this closer to the time.
                  </p>
                </div>
              </div>
            );
          }

          const tier = plan.density_tier;
          const label = DENSITY_TIER_LABELS[tier];
          const lesson = lessonByTpNumber.get(tpNumber);
          const tpPlan = tpPlanByTpNumber.get(tpNumber);
          const selfEvaluation = selfEvalByTpNumber.get(tpNumber);
          const feedback = feedbackByTpNumber.get(tpNumber);
          const cardStatus = getTpCardStatus({
            planSubmitted: Boolean(tpPlan?.submitted_at),
            taught: Boolean(plan.taught_at),
            selfEvalSubmitted: Boolean(selfEvaluation?.submitted_at),
            feedbackSubmitted: Boolean(feedback?.submitted_at),
            grade: feedback?.grade,
          });

          return (
            <Link key={tpNumber} href={`/dashboard/trainee/plan/${tpNumber}`} className="card-interactive flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-lg text-ink">TP{tpNumber}</h2>
                <div className="shrink-0 text-right">
                  {feedback?.submitted_at && feedback.grade ? (
                    <StandardRatingPill rating={feedback.grade} />
                  ) : (
                    <span className="badge-solid">{label.name}</span>
                  )}
                  <p className="mt-1 text-xs text-muted">{label.blurb}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <div>
                  <p className="text-sm text-muted">Main aim</p>
                  <p className="line-clamp-2 text-ink">{plan.main_lesson_aim}</p>
                </div>
                {plan.sub_aim ? (
                  <div>
                    <p className="text-sm text-muted">Sub aim</p>
                    <p className="line-clamp-2 text-ink">{plan.sub_aim}</p>
                  </div>
                ) : null}
              </div>

              {lesson ? (
                <div className="mt-3 border-t border-border-faint pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted">Outcome</p>
                    <StandardRatingPill rating={lesson.tutor_assessment} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {[
                      lesson.lesson_date,
                      lesson.level,
                      lesson.length_minutes ? `${lesson.length_minutes} mins` : null,
                      lesson.trainer_id ? trainerNameById.get(lesson.trainer_id) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}

              <p
                className={`mt-3 border-t border-border-faint pt-3 text-sm ${
                  cardStatus.tone === "on-track"
                    ? "text-primary"
                    : cardStatus.tone === "at-risk"
                      ? "text-destructive"
                      : "text-muted"
                }`}
              >
                {cardStatus.label}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
