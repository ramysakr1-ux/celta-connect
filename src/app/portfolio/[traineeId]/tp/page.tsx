import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { getTpCardStatus, TP_LESSON_LENGTH_MINUTES, type TpCardStatus } from "@/lib/tp-plan-content";
import { computeCriteriaPct, CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import { ASSIGNMENT_INFO, ASSIGNMENT_ORDER, ASSIGNMENT_STATUS_LABEL } from "@/lib/assignment-info";
import { TpRow } from "@/app/portfolio/[traineeId]/tp/tp-row";
import type { Database } from "@/lib/supabase/types";

type SubmissionStatus = Database["public"]["Tables"]["assignments"]["Row"]["first_status"];

// The single "further along of the two" status for one assignment row --
// approved on the first submission wins outright; otherwise a resubmission
// in progress takes priority over the (now moot) first-round status.
function overallAssignmentStatus(
  a: { first_status: SubmissionStatus; resubmission_status: SubmissionStatus } | undefined
): SubmissionStatus | null {
  if (!a) return null;
  if (a.first_status === "approved") return "approved";
  if (a.resubmission_status !== "not_submitted") return a.resubmission_status;
  return a.first_status;
}

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

// §6 -- TP1-8 table (checkpoint 2 restyle: was a card grid, App Redesign.dc.html
// 1d shows a table). Every slot is always visible so a trainee can see the
// shape of the course from day one; a slot with no plan_assignments row yet
// renders as a locked row, except TP7/8 which link out to the self-select
// syllabus planning grid. Reuses the exact same status state machine
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
  // Criteria % card stays staff/assessor-only, matching the same boundary
  // the portfolio sidebar's "CELTA 5 / N%" meta already draws (a trainee's
  // own real celta5 tab reads this via a different RPC-based, RLS-safe
  // path -- not duplicated here for one summary card).
  const canSeeCriteria = isStaff || Boolean(assessorCourseId);

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  if (assessorCourseId) {
    const { data: trainee } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
    if (!trainee || trainee.course_id !== assessorCourseId) notFound();
  }

  const [{ data: plans }, { data: lessons }, { data: tpPlans }, { data: selfEvaluations }, { data: feedbackRows }, { data: assignments }] =
    await Promise.all([
      supabase.from("plan_assignments").select("*").eq("trainee_id", traineeId),
      supabase.from("tp_lessons").select("*").eq("trainee_id", traineeId).not("tp_number", "is", null),
      supabase.from("tp_plans").select("tp_number, submitted_at").eq("trainee_id", traineeId),
      supabase.from("tp_self_evaluations").select("tp_number, submitted_at").eq("trainee_id", traineeId),
      supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", traineeId),
      supabase
        .from("assignments")
        .select("assignment_type, first_status, resubmission_status, due_date")
        .eq("trainee_id", traineeId),
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

  // Real "taught" signal is plan_assignments.taught_at (migration 0017) --
  // tp_lessons is only ever written by the old, pre-rebuild trainer page
  // and reads as permanently empty for any course run through the live
  // app (same dead-table bug fixed in src/lib/roster.ts).
  const tpsTaught = (plans ?? []).filter((p) => p.taught_at).length;
  const assessedHours = (tpsTaught * TP_LESSON_LENGTH_MINUTES) / 60;

  let criteriaPct: number | null = null;
  if (canSeeCriteria) {
    const admin = createAdminClient();
    const { data: matrix } = await admin.from("celta5_matrix").select("criteria_code, tutor_status_stage2").eq("trainee_id", traineeId);
    const matrixByCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m.tutor_status_stage2]));
    criteriaPct = computeCriteriaPct(matrixByCode);
  }
  // Was a hardcoded 41 -- silently wrong the moment the criteria set's size
  // changed (it did, 2026-08-19: 3c turned out to be a real Cambridge code,
  // taking the total to 42). Derived from the same source of truth
  // computeCriteriaPct itself uses, so it can't drift out of sync again.
  const achievedCount = criteriaPct !== null ? Math.round((criteriaPct / 100) * CELTA_CRITERIA_CODES.length) : 0;

  // "Write TP feedback" needs a real destination -- the earliest TP whose
  // self-evaluation is in but feedback isn't yet, matching the exact same
  // "Awaiting tutor feedback" state the row's own status pill already shows
  // (getTpCardStatus), rather than a second, possibly-disagreeing check.
  const nextTpNeedingFeedback = TP_NUMBERS.find((tpNumber) => {
    const plan = planByTpNumber.get(tpNumber);
    if (!plan) return false;
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
    return status.label === "Awaiting tutor feedback";
  });

  // for-claude-code-trainee-interface.md's "Carried forward" panel --
  // starred action points from the MOST RECENT feedback (highest TP number
  // with feedback submitted), already folded into the next plan as
  // personal aims. Reuses the exact same starred-point extraction as the
  // single-TP drill-down's own "previous action point" suggestion
  // (tp/[tpNumber]/page.tsx), just widened to both planning+teaching and
  // not capped to one.
  const mostRecentFeedbackTp = [...TP_NUMBERS].reverse().find((n) => feedbackByTpNumber.get(n)?.submitted_at);
  let carriedForward: string[] = [];
  if (mostRecentFeedbackTp) {
    const plan = planByTpNumber.get(mostRecentFeedbackTp);
    if (plan) {
      const { data: fullFeedback } = await supabase
        .from("tp_feedback")
        .select("action_points_planning, action_points_teaching")
        .eq("trainee_id", traineeId)
        .eq("tp_number", mostRecentFeedbackTp)
        .maybeSingle();
      carriedForward = [
        ...(fullFeedback?.action_points_planning ?? []).filter((p) => p.starred),
        ...(fullFeedback?.action_points_teaching ?? []).filter((p) => p.starred),
      ].map((p) => p.text);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Teaching practice record</p>
          <h2 className="font-serif text-2xl text-ink">
            {tpsTaught} of 8 taught · {assessedHours.toFixed(1)} hrs assessed
          </h2>
        </div>
        {isStaff && nextTpNeedingFeedback ? (
          <Link
            href={`/portfolio/${traineeId}/tp/${nextTpNeedingFeedback}`}
            className="shrink-0 rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Write TP feedback
          </Link>
        ) : null}
      </div>

      <div className="sheet overflow-hidden !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">TP</th>
              <th className="text-sm text-muted">Focus</th>
              <th className="text-sm text-muted">Date</th>
              <th className="text-sm text-muted">Status</th>
              <th className="text-right text-sm text-muted">Action</th>
            </tr>
          </thead>
          <tbody>
            {TP_NUMBERS.map((tpNumber) => {
              const plan = planByTpNumber.get(tpNumber);

              if (!plan) {
                const selfSelect = (tpNumber === 7 || tpNumber === 8) && !isStaff;
                const href = selfSelect ? "/dashboard/trainee/plan/syllabus-grid" : null;
                return (
                  <TpRow key={tpNumber} href={href}>
                    <td className="font-serif text-lg text-muted">TP{tpNumber}</td>
                    <td className="text-sm text-muted">
                      {selfSelect ? "Choose your own topic in the syllabus planning grid" : "Not yet assigned"}
                    </td>
                    <td className="text-sm text-muted">Not yet scheduled</td>
                    <td>
                      <span className="pill pill-neutral">{selfSelect ? "Self-select" : "Not yet assigned"}</span>
                    </td>
                    <td className="text-right text-sm text-muted">{selfSelect ? "Choose topic →" : "—"}</td>
                  </TpRow>
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
              const trainerName = (lesson?.trainer_id && trainerNameById.get(lesson.trainer_id)) || null;

              return (
                <TpRow key={tpNumber} href={`/portfolio/${traineeId}/tp/${tpNumber}`}>
                  <td className="font-serif text-lg text-ink">TP{tpNumber}</td>
                  <td className="text-sm text-ink">
                    {plan.short_title ?? shortenAim(plan.main_lesson_aim)}
                    {lesson?.level || trainerName ? (
                      <span className="block text-xs text-muted">
                        {[lesson?.level, trainerName, lesson?.length_minutes ? `${lesson.length_minutes} mins` : label.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-sm text-muted">{lesson?.lesson_date ?? "Not yet scheduled"}</td>
                  <td>
                    <span className={`pill ${TONE_PILL_CLASS[status.tone]}`}>{status.label}</span>
                  </td>
                  <td className="text-right text-sm text-primary">
                    {tpPlan?.submitted_at ? "View feedback" : "Lesson plan"}
                  </td>
                </TpRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isStaff && carriedForward.length > 0 ? (
        <div className="sheet flex flex-col gap-2.5">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">Carried forward</p>
          <p className="text-xs text-muted">
            Starred action points from TP{mostRecentFeedbackTp} feedback, already folded into your next lesson plan
            as personal aims.
          </p>
          <ul className="flex flex-col gap-1.5">
            {carriedForward.map((point, i) => (
              <li key={i} className="border-l-2 border-gold pl-2.5 text-sm text-ink">
                {point}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {canSeeCriteria ? (
          <div className="sheet flex flex-col gap-3.5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Criteria — stage 2</p>
            <div className="flex items-baseline gap-2.5">
              <span className="font-serif text-[32px] leading-none text-ink">{criteriaPct}%</span>
              <span className="text-xs text-muted">{achievedCount} of {CELTA_CRITERIA_CODES.length} met</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-1 rounded-full bg-primary" style={{ width: `${criteriaPct}%` }} />
            </div>
          </div>
        ) : null}

        <div className="sheet flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Written assignments</p>
          <div className="flex flex-col">
            {ASSIGNMENT_ORDER.map((type, i) => {
              const a = (assignments ?? []).find((row) => row.assignment_type === type);
              const overall = overallAssignmentStatus(a);
              const statusText = overall ? ASSIGNMENT_STATUS_LABEL[overall] : "Not started";
              const statusClass =
                overall === "approved"
                  ? "text-ink font-semibold"
                  : overall === "resubmission_required"
                    ? "text-status-warning-text"
                    : "text-muted";
              return (
                <div
                  key={type}
                  className={`flex items-center justify-between py-1.75 text-sm ${i > 0 ? "border-t border-border-faint" : ""}`}
                >
                  <span className="text-ink">
                    {ASSIGNMENT_ORDER.indexOf(type) + 1} · {ASSIGNMENT_INFO[type].title}
                  </span>
                  <span className={`font-semibold ${statusClass}`}>{statusText}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
