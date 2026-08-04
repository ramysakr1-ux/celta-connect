import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { getTpCardStatus, type TpCardStatus } from "@/lib/tp-plan-content";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const TONE_PILL_CLASS: Record<TpCardStatus["tone"], string> = {
  "on-track": "pill-success",
  "at-risk": "pill-danger",
  pending: "pill-neutral",
};

// §6 -- TP1-8 grid. Every slot is always visible so a trainee can see the
// shape of the course from day one; a slot with no plan_assignments row yet
// renders as a locked box, except TP7/8 which link out to the self-select
// syllabus planning grid (see project memory -- that pipeline is untouched
// here, just linked to). Reuses the exact same status state machine
// (getTpCardStatus) as the pre-existing /dashboard/trainee/plan grid so the
// two views can never disagree about where a trainee stands.
export default async function TpHubPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  if (!session?.profile) notFound();
  const viewer = session.profile;
  const isStaff = viewer.role === "trainer" || viewer.role === "admin";

  const supabase = await createClient();
  const [{ data: plans }, { data: lessons }, { data: tpPlans }, { data: selfEvaluations }, { data: feedbackRows }] =
    await Promise.all([
      supabase.from("plan_assignments").select("*").eq("trainee_id", traineeId),
      supabase.from("tp_lessons").select("*").eq("trainee_id", traineeId).not("tp_number", "is", null),
      supabase.from("tp_plans").select("tp_number, submitted_at").eq("trainee_id", traineeId),
      supabase.from("tp_self_evaluations").select("tp_number, submitted_at").eq("trainee_id", traineeId),
      supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", traineeId),
    ]);

  const planByTpNumber = new Map((plans ?? []).map((p) => [p.tp_number, p]));
  const lessonByTpNumber = new Map((lessons ?? []).map((l) => [l.tp_number as number, l]));
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">Teaching Practice Hub</h2>
        <p className="text-xs text-muted">TP1 – TP8</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TP_NUMBERS.map((tpNumber) => {
          const plan = planByTpNumber.get(tpNumber);

          if (!plan) {
            if ((tpNumber === 7 || tpNumber === 8) && !isStaff) {
              return (
                <Link
                  key={tpNumber}
                  href="/dashboard/trainee/plan/syllabus-grid"
                  className="sheet group flex h-full flex-col justify-center gap-1 p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
                >
                  <span className="font-serif text-2xl text-ink">TP{tpNumber}</span>
                  <p className="text-sm text-muted">Choose your own topic in the syllabus planning grid.</p>
                </Link>
              );
            }
            return (
              <div key={tpNumber} className="sheet flex h-full flex-col justify-center gap-1 p-5">
                <span className="font-serif text-2xl text-muted">TP{tpNumber}</span>
                <p className="text-sm text-muted">Not yet assigned.</p>
              </div>
            );
          }

          const tier = plan.density_tier;
          const label = DENSITY_TIER_LABELS[tier];
          const lesson = lessonByTpNumber.get(tpNumber);
          const tpPlan = tpPlanByTpNumber.get(tpNumber);
          const selfEvaluation = selfEvalByTpNumber.get(tpNumber);
          const feedback = feedbackByTpNumber.get(tpNumber);
          const status = getTpCardStatus({
            planSubmitted: Boolean(tpPlan?.submitted_at),
            taught: Boolean(plan.taught_at),
            selfEvalSubmitted: Boolean(selfEvaluation?.submitted_at),
            feedbackSubmitted: Boolean(feedback?.submitted_at),
            grade: feedback?.grade,
          });

          return (
            <Link
              key={tpNumber}
              href={`/portfolio/${traineeId}/tp/${tpNumber}`}
              className="sheet group flex h-full flex-col p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-serif text-2xl text-ink">TP{tpNumber}</span>
                <span className={`pill ${TONE_PILL_CLASS[status.tone]}`}>{status.label}</span>
              </div>

              <p className="mt-2 line-clamp-2 text-sm font-medium text-ink">{plan.main_lesson_aim}</p>
              {plan.sub_aim ? <p className="mt-0.5 line-clamp-1 text-xs text-muted">{plan.sub_aim}</p> : null}

              <div className="mt-3 flex flex-col gap-1 text-xs text-muted">
                {lesson ? (
                  <p>
                    {[
                      lesson.lesson_date,
                      lesson.level,
                      lesson.length_minutes ? `${lesson.length_minutes} mins` : null,
                      lesson.trainer_id ? trainerNameById.get(lesson.trainer_id) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : (
                  <p>{label.name}</p>
                )}
              </div>

              <p className="mt-auto border-t border-border-faint pt-3 text-xs text-muted">
                {tpPlan?.submitted_at ? "Lesson plan submitted" : "Plan not yet submitted"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
