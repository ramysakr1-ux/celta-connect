import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Users, Clock, GraduationCap } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { getTpCardStatus, type TpCardStatus } from "@/lib/tp-plan-content";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const TONE_PILL_CLASS: Record<TpCardStatus["tone"], string> = {
  "on-track": "pill-success",
  "at-risk": "pill-danger",
  pending: "pill-neutral",
};

// TP3-6 aims are already generated as a short "Category: Topic" string
// (e.g. "Vocabulary: Air Travel") and need no help. TP1/2 ("scripted"
// tier) are deliberately generated as a full CELTA-style sentence
// instead ("By the end of the lesson, Ss will be better able to use...")
// -- there's no separate short field for those yet, so this strips the
// near-universal boilerplate opener as a stopgap to make the truncated
// card title read better, without touching the underlying data (the full
// sentence is still what's stored and shown on the TP detail page).
const AIM_BOILERPLATE = /^by the end of (the lesson|this lesson),?\s*(ss|students)\s+will be better able to\s*/i;
function shortenAim(aim: string): string {
  const stripped = aim.replace(AIM_BOILERPLATE, "");
  return stripped.length > 0 ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : aim;
}

// §6 -- TP1-8 grid. Every slot is always visible so a trainee can see the
// shape of the course from day one; a slot with no plan_assignments row yet
// renders as a locked box, except TP7/8 which link out to the self-select
// syllabus planning grid (see project memory -- that pipeline is untouched
// here, just linked to). Reuses the exact same status state machine
// (getTpCardStatus) as the pre-existing /dashboard/trainee/plan grid so the
// two views can never disagree about where a trainee stands.
export default async function TpHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId } = await params;
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  // See portfolio/[traineeId]/layout.tsx's previewAsTrainee comment.
  const isStaff = (viewer?.role === "trainer" || viewer?.role === "admin") && preview !== "trainee";

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  if (assessorCourseId) {
    const { data: trainee } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
    if (!trainee || trainee.course_id !== assessorCourseId) notFound();
  }

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

  // Admin client regardless of viewer: a trainee has no RLS SELECT on a
  // trainer's profile row at all (only their own + subgroup-mates), so
  // the session-scoped client silently returned zero trainers here for a
  // trainee viewing their own assigned lessons -- same bug shape as the
  // final report's signatory lookup earlier this session.
  const trainerIds = [...new Set((lessons ?? []).map((l) => l.trainer_id).filter(Boolean))];
  const { data: trainers } =
    trainerIds.length > 0
      ? await createAdminClient().from("profiles").select("id, full_name").in("id", trainerIds as string[])
      : { data: [] };
  const trainerNameById = new Map((trainers ?? []).map((t) => [t.id, t.full_name]));

  const assessedHours = (lessons ?? []).reduce((sum, l) => sum + (l.length_minutes ?? 0), 0) / 60;
  const hoursStillRequired = Math.max(0, 6 - assessedHours);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">Teaching Practice Hub</h2>
        <p className="text-xs text-muted">TP1 – TP8</p>
      </div>

      <div className="sheet flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Assessed teaching towards the mandatory 6 hours
          </p>
          <p className="mt-1 font-serif text-2xl leading-none text-ink">
            {assessedHours.toFixed(2)} <span className="text-base text-muted">of 6.00 hrs</span>
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-primary/20">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.min(1, assessedHours / 6) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-sm text-muted sm:w-56 sm:text-right">
          {hoursStillRequired > 0
            ? `${hoursStillRequired.toFixed(2)} hrs of assessed teaching still required.`
            : "Mandatory assessed teaching hours complete."}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-fr">
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
              <div key={tpNumber} className="sheet flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-serif text-2xl leading-none text-muted">TP{tpNumber}</span>
                  <span className="pill pill-neutral">Not yet assigned</span>
                </div>

                <p className="mt-3 font-semibold leading-snug text-muted">Not yet assigned</p>

                <div className="mt-4 flex flex-col gap-1.5 text-xs text-muted">
                  <p className="flex items-center gap-2">
                    <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                    Not yet scheduled
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="size-3.5 shrink-0" aria-hidden="true" />
                    Level TBC
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                    Duration TBC
                  </p>
                  <p className="flex items-center gap-2">
                    <GraduationCap className="size-3.5 shrink-0" aria-hidden="true" />
                    Trainer TBC
                  </p>
                </div>

                <p className="mt-4 border-t border-border pt-3 text-xs text-muted">Awaiting rotation assignment</p>
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
                <span className="font-serif text-2xl leading-none text-ink">TP{tpNumber}</span>
                <span className={`pill ${TONE_PILL_CLASS[status.tone]}`}>{status.label}</span>
              </div>

              <p className="mt-3 text-base font-semibold leading-snug text-ink">
                {plan.short_title ?? shortenAim(plan.main_lesson_aim)}
              </p>

              <div className="mt-4 flex flex-col gap-1.5 text-xs text-muted">
                <p className="flex items-center gap-2">
                  <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                  {lesson?.lesson_date ?? "Not yet scheduled"}
                </p>
                <p className="flex items-center gap-2">
                  <Users className="size-3.5 shrink-0" aria-hidden="true" />
                  {lesson?.level ?? "Level TBC"}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  {lesson?.length_minutes ? `${lesson.length_minutes} mins` : label.name}
                </p>
                <p className="flex items-center gap-2">
                  <GraduationCap className="size-3.5 shrink-0" aria-hidden="true" />
                  {(lesson?.trainer_id && trainerNameById.get(lesson.trainer_id)) || "Trainer TBC"}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className={tpPlan?.submitted_at ? "text-[oklch(45%_0.13_150)]" : "text-muted"}>
                  {tpPlan?.submitted_at ? "Lesson plan submitted" : "Plan not yet submitted"}
                </span>
                <span className="flex items-center gap-1 font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
