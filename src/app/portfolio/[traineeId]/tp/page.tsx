import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { getTpCardStatus, TP_LESSON_LENGTH_MINUTES, type TpCardStatus } from "@/lib/tp-plan-content";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { computeCriteriaPct, CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import { ASSIGNMENT_INFO, ASSIGNMENT_ORDER, ASSIGNMENT_STATUS_LABEL } from "@/lib/assignment-info";
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

// for-claude-code-trainee-interface.md's "My teaching" row status -- a
// different vocabulary from getTpCardStatus's submission-workflow states
// (Draft in progress / Awaiting tutor feedback / etc, still used for the
// in-progress cases below): once feedback is released this shows whether
// the lesson met standard, once it's today it says so, and an unmarked
// future lesson says what's still due -- never a grade, per the trainee
// app's own "no grade column, ever" rule.
function myTeachingRowStatus(input: {
  isToday: boolean;
  taught: boolean;
  planSubmitted: boolean;
  selfEvalSubmitted: boolean;
  feedbackSubmitted: boolean;
  grade: "above_standard" | "to_standard" | "not_to_standard" | null | undefined;
}): { label: string; pillClass: string } {
  if (input.feedbackSubmitted) {
    return input.grade === "not_to_standard"
      ? { label: "Not to standard", pillClass: "pill-danger" }
      : input.grade === "above_standard"
        ? { label: "Above standard", pillClass: "pill-success" }
        : { label: "To standard", pillClass: "pill-success" };
  }
  if (input.isToday) return { label: "Today", pillClass: "pill-info" };
  if (!input.taught && !input.planSubmitted) return { label: "Plan due", pillClass: "pill-warning" };
  const inProgress = getTpCardStatus({
    planSubmitted: input.planSubmitted,
    taught: input.taught,
    selfEvalSubmitted: input.selfEvalSubmitted,
    feedbackSubmitted: input.feedbackSubmitted,
  });
  return { label: inProgress.label, pillClass: TONE_PILL_CLASS[inProgress.tone] };
}

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

  // Cosmetic "Today" highlight only, not a compliance boundary -- not worth
  // this page's first center/timezone fetch just to swap DEFAULT_TIMEZONE
  // for the real one.
  const today = toLocalIso(new Date(), DEFAULT_TIMEZONE);

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

  // Ramy, 29 Aug 2026: "all eight TPs are there -- they should not be. Only
  // TP one will be there, and as soon as they finish TP one, TP two appears
  // and so on."
  //
  // Gated on taught_at rather than on a plan existing, because a trainer
  // can assign the whole rotation on day one -- which would reveal all
  // eight immediately and defeat the point. Shows every TP taught so far
  // plus the next one, so a candidate always sees exactly one lesson ahead
  // and their own history behind.
  //
  // Staff see all eight regardless: a tutor needs the whole rotation to
  // plan against, and hiding it from them would break the page they use to
  // run TP.
  const highestTaught = (plans ?? []).reduce((max, p) => (p.taught_at && p.tp_number > max ? p.tp_number : max), 0);
  const visibleTpNumbers = isStaff ? [...TP_NUMBERS] : TP_NUMBERS.filter((n) => n <= highestTaught + 1);
  const assessedHours = (tpsTaught * TP_LESSON_LENGTH_MINUTES) / 60;

  let criteriaPct: number | null = null;
  if (canSeeCriteria) {
    const admin = createAdminClient();
    const { data: matrix } = await admin.from("celta5_matrix").select("criteria_code, tutor_status_stage2").eq("trainee_id", traineeId);
    const matrixByCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m.tutor_status_stage2]));
    criteriaPct = computeCriteriaPct(matrixByCode);
  }
  // Was a hardcoded "41" in the label below -- fixed 2026-08-20 to derive
  // from the same source of truth computeCriteriaPct itself uses (41 real
  // codes; a fabricated "3c" briefly took this to 42 between 2026-08-19 and
  // 2026-08-20, see celta-criteria.ts), so it can't drift out of sync again.
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

  // for-claude-code-trainee-interface.md's "My teaching" header has two
  // trainee-facing shortcuts (mockup: "Log an observation" / "Open TP2
  // plan") that this page never had -- same "next TP needing X" pattern
  // as nextTpNeedingFeedback above, just for "not yet planned" instead of
  // "not yet fed back".
  const nextTpNeedingPlan = TP_NUMBERS.find((tpNumber) => {
    const plan = planByTpNumber.get(tpNumber);
    if (!plan || plan.taught_at) return false;
    return !tpPlanByTpNumber.get(tpNumber)?.submitted_at;
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
        {!isStaff ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/portfolio/${traineeId}/celta5`}
              className="trainee-hover-fill rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink"
            >
              Log an observation
            </Link>
            {nextTpNeedingPlan ? (
              <Link
                href={`/portfolio/${traineeId}/tp/${nextTpNeedingPlan}`}
                className="rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Open TP{nextTpNeedingPlan} plan
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={`grid grid-cols-1 gap-4 ${!isStaff && carriedForward.length > 0 ? "lg:grid-cols-[1.5fr_1fr]" : ""}`}>
        <div className="sheet flex flex-col gap-1 border-t-[3px] border-t-primary">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Your lessons</p>
          <div className="flex flex-col">
            {visibleTpNumbers.map((tpNumber) => {
              const plan = planByTpNumber.get(tpNumber);

              if (!plan) {
                const selfSelect = (tpNumber === 7 || tpNumber === 8) && !isStaff;
                const href = selfSelect ? "/dashboard/trainee/plan/syllabus-grid" : null;
                const row = (
                  <div className="flex items-start gap-3 border-t border-border-faint py-2.5 first:border-t-0">
                    <span className="font-serif text-lg text-muted">TP{tpNumber}</span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <p className="text-sm text-muted">{selfSelect ? "Choose your own topic in the syllabus planning grid" : "Not yet assigned"}</p>
                    </div>
                    <span className="pill pill-neutral shrink-0">{selfSelect ? "Self-select" : "Not yet assigned"}</span>
                  </div>
                );
                return href ? (
                  <Link key={tpNumber} href={href} className="trainee-hover -mx-2 rounded-[6px] px-2">
                    {row}
                  </Link>
                ) : (
                  <div key={tpNumber}>{row}</div>
                );
              }

              const tier = plan.density_tier;
              const label = DENSITY_TIER_LABELS[tier];
              const lesson = lessonByTpNumber.get(tpNumber);
              const tpPlan = tpPlanByTpNumber.get(tpNumber);
              const selfEvaluation = selfEvalByTpNumber.get(tpNumber);
              const feedback = feedbackByTpNumber.get(tpNumber);
              const isToday = lesson?.lesson_date === today;
              const status = myTeachingRowStatus({
                isToday,
                taught: Boolean(plan.taught_at),
                planSubmitted: Boolean(tpPlan?.submitted_at),
                selfEvalSubmitted: Boolean(selfEvaluation?.submitted_at),
                feedbackSubmitted: Boolean(feedback?.submitted_at),
                grade: feedback?.grade,
              });
              const trainerName = (lesson?.trainer_id && trainerNameById.get(lesson.trainer_id)) || null;

              return (
                <Link
                  key={tpNumber}
                  href={`/portfolio/${traineeId}/tp/${tpNumber}`}
                  className="trainee-hover -mx-2 flex items-start gap-3 rounded-[6px] border-t border-border-faint px-2 py-2.5 first:border-t-0"
                  style={{ borderLeft: `3px solid ${isToday ? "var(--color-primary)" : "var(--color-muted)"}`, marginLeft: 0, paddingLeft: 10 }}
                >
                  <span className="font-serif text-lg text-ink">TP{tpNumber}</span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-sm text-ink">{plan.short_title ?? shortenAim(plan.main_lesson_aim)}</p>
                    <p className="text-xs text-muted">
                      {[lesson?.lesson_date ?? "Not yet scheduled", lesson?.level, trainerName, lesson?.length_minutes ? `${lesson.length_minutes} mins` : label.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className={`pill ${status.pillClass} shrink-0`}>{status.label}</span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            No grade column anywhere. A candidate never sees a provisional grade -- they see whether a lesson was to
            standard, and what to do next.
          </p>
        </div>

        {!isStaff && carriedForward.length > 0 ? (
          // Decorative teal/garnet alternation against "Your lessons" beside
          // it -- no status meaning of its own (the warning-colored eyebrow
          // text inside is untouched).
          <div className="sheet sheet-garnet flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-status-warning-text uppercase">Carried forward</p>
            <p className="text-xs text-muted">
              Starred action points from TP{mostRecentFeedbackTp} feedback, already folded into your next lesson plan
              as personal aims.
            </p>
            <ul className="flex flex-col gap-1.5">
              {carriedForward.map((point, i) => (
                <li key={i} className="border-l-2 border-status-warning-text pl-2.5 text-sm text-ink">
                  {point}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted">Starred action points arrive as personal aims in your next plan automatically. You never copy them across.</p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {canSeeCriteria ? (
          <div className="sheet flex flex-col gap-3.5 border-t-[3px] border-t-[oklch(38%_0.085_155)]">
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

        {/* Ramy, 29 Aug 2026: "at the bottom it says written assignments
            -- we don't need them there, because there is a written
            assignments tab." It duplicated the tab in full, including
            status, so the two could disagree the moment one was edited. */}
      </div>
    </div>
  );
}
