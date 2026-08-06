import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { DENSITY_TIER_LABELS } from "@/lib/tp-density";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { getTpCardStatus, type FeedbackPoint, type TpCardStatus } from "@/lib/tp-plan-content";
import { LessonPlanForm } from "@/app/dashboard/trainee/plan/[tpNumber]/lesson-plan-form";
import { MaterialsSection } from "@/app/dashboard/trainee/plan/[tpNumber]/materials-section";
import { SelfEvaluationSection } from "@/app/dashboard/trainee/plan/[tpNumber]/self-evaluation-section";
import { FeedbackForm } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/feedback-form";
import { shareMaterialWithStudents, unshareMaterialWithStudents } from "@/app/portfolio/[traineeId]/tp/[tpNumber]/share-actions";
import type { Database } from "@/lib/supabase/types";

type TpFeedback = Database["public"]["Tables"]["tp_feedback"]["Row"];

const TONE_PILL_CLASS: Record<TpCardStatus["tone"], string> = {
  "on-track": "pill-success",
  "at-risk": "pill-danger",
  pending: "pill-neutral",
};

function collectCriteriaCodes(feedback: TpFeedback | null): string[] {
  if (!feedback) return [];
  const points = [
    ...feedback.strengths_planning,
    ...feedback.action_points_planning,
    ...feedback.strengths_teaching,
    ...feedback.action_points_teaching,
  ] as FeedbackPoint[];
  return [...new Set(points.flatMap((p) => p.criteria_codes))].sort();
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="whitespace-pre-line text-ink">{value}</p>
    </div>
  );
}

// §7 -- single TP record. Trainee viewers get the real editable pipeline
// (LessonPlanForm/MaterialsSection/SelfEvaluationSection, exactly as built
// for /dashboard/trainee/plan/[tpNumber] -- same tables, same Server
// Actions, just re-skinned around them). Staff viewers get a read-only plan
// render plus the real FeedbackForm for grading, mirroring
// /dashboard/trainer/trainees/[id]/tp/[tpNumber]. The "criteria evidenced"
// rail on the right is new presentation only -- it aggregates the REAL
// criteria_codes already tagged on this TP's feedback points (see
// feedback-point-editor.tsx), not a separate/invented criteria set.
export default async function TpDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string; tpNumber: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId, tpNumber: tpNumberParam } = await params;
  const { preview } = await searchParams;
  const tpNumber = Number(tpNumberParam);
  if (!Number.isInteger(tpNumber) || tpNumber < 1 || tpNumber > 8) notFound();

  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  // Raw role check -- used ONLY for the access gate below. Must NOT fold in
  // previewAsTrainee, or a staff member previewing this exact page would
  // 404 themselves (see portfolio/[traineeId]/layout.tsx's comment).
  const isRealStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  if (viewer && !isRealStaff && viewer.id !== traineeId) notFound();
  // Rendering-only from here down: hides staff-only UI while previewing,
  // same rule as everywhere else in the portfolio tree.
  const isEditableStaff = isRealStaff && preview !== "trainee";
  const isStaff = isEditableStaff || Boolean(assessorCourseId);

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, full_name, center_id, course_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const admin = createAdminClient();
  const [{ data: assignment }, { data: plan }, { data: googleConnection }] = await Promise.all([
    supabase.from("plan_assignments").select("*").eq("trainee_id", traineeId).eq("tp_number", tpNumber).maybeSingle(),
    supabase.from("tp_plans").select("*").eq("trainee_id", traineeId).eq("tp_number", tpNumber).maybeSingle(),
    admin.from("center_google_connections").select("center_id").eq("center_id", trainee.center_id).maybeSingle(),
  ]);
  const hasGoogleConnection = Boolean(googleConnection);

  if (!assignment) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={`/portfolio/${traineeId}/tp`} className="text-sm text-muted hover:text-primary">
          ← All teaching practices
        </Link>
        <div className="sheet p-6">
          <h1 className="font-serif text-2xl text-ink">TP{tpNumber}</h1>
          <p className="mt-2 text-sm text-muted">
            Not yet assigned{isStaff ? "." : " -- your trainer will unlock this closer to the time."}
          </p>
        </div>
      </div>
    );
  }

  const [{ data: languageAnalysis }, { data: materials }, { data: selfEvaluation }, { data: feedback }] = plan
    ? await Promise.all([
        supabase.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
        supabase.from("tp_materials").select("*").eq("tp_plan_id", plan.id).order("created_at"),
        supabase.from("tp_self_evaluations").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
        supabase.from("tp_feedback").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      ])
    : [{ data: null }, { data: [] }, { data: null }, { data: null }];

  let previousActionPoints: string[] = [];
  if (!isStaff && tpNumber > 1) {
    const { data: previousPlan } = await supabase
      .from("tp_plans")
      .select("id")
      .eq("trainee_id", traineeId)
      .eq("tp_number", tpNumber - 1)
      .maybeSingle();
    if (previousPlan) {
      const { data: previousFeedback } = await supabase
        .from("tp_feedback")
        .select("action_points_planning, action_points_teaching")
        .eq("tp_plan_id", previousPlan.id)
        .maybeSingle();
      previousActionPoints = [
        ...(previousFeedback?.action_points_planning ?? []),
        ...(previousFeedback?.action_points_teaching ?? []),
      ]
        .filter((p) => p.starred)
        .map((p) => p.text);
    }
  }

  const materialIds = (materials ?? []).map((m) => m.id);
  const { data: sharedRows } =
    isStaff && materialIds.length > 0
      ? await supabase.from("volunteer_shared_materials").select("tp_material_id").in("tp_material_id", materialIds)
      : { data: [] };
  const sharedMaterialIds = new Set((sharedRows ?? []).map((r) => r.tp_material_id));

  const tier = assignment.density_tier;
  const densityLabel = DENSITY_TIER_LABELS[tier];
  const criteriaCodes = collectCriteriaCodes(feedback ?? null);

  const status = getTpCardStatus({
    planSubmitted: Boolean(plan?.submitted_at),
    taught: Boolean(assignment.taught_at),
    selfEvalSubmitted: Boolean(selfEvaluation?.submitted_at),
    feedbackSubmitted: Boolean(feedback?.submitted_at),
    grade: feedback?.grade,
  });

  const bannerMessage = !plan?.submitted_at
    ? null
    : !feedback?.submitted_at
      ? "Submitted -- read-only. Your plan is locked while your tutor assesses this lesson. Feedback appears here once it is released."
      : "Submitted -- read-only. Your tutor has released feedback for this teaching practice.";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Link href={`/portfolio/${traineeId}/tp`} className="text-sm text-muted hover:text-primary">
          ← All teaching practices
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-ink">
              TP{tpNumber} — {assignment.main_lesson_aim}
            </h1>
            <p className="mt-1 text-sm text-muted">{densityLabel.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {plan?.submitted_at && selfEvaluation?.submitted_at && feedback?.submitted_at ? (
              <a
                href={`/api/tp-plans/${plan.id}/pdf`}
                className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
              >
                Export TP PDF
              </a>
            ) : null}
            <span className={`pill ${TONE_PILL_CLASS[status.tone]}`}>{status.label}</span>
          </div>
        </div>

        {!isStaff && bannerMessage ? (
          <div className="sheet flex items-center gap-2 border-primary/20 bg-accent/30 text-sm text-ink">
            <span aria-hidden="true">🔒</span>
            {bannerMessage}
          </div>
        ) : null}

        <div className="sheet p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-serif text-lg text-ink">Assigned brief</h2>
            <span className="badge-solid">{densityLabel.name}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{densityLabel.blurb}</p>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <p className="text-sm text-muted">Main aim</p>
              <p className="text-ink">{assignment.main_lesson_aim}</p>
            </div>
            {assignment.sub_aim ? (
              <div>
                <p className="text-sm text-muted">Sub aim</p>
                <p className="text-ink">{assignment.sub_aim}</p>
              </div>
            ) : null}
            {assignment.materials_description ? (
              <div>
                <p className="text-sm text-muted">Materials</p>
                <p className="text-ink">{assignment.materials_description}</p>
              </div>
            ) : null}
            {assignment.page_references ? (
              <div>
                <p className="text-sm text-muted">Page references</p>
                <p className="text-ink">{assignment.page_references}</p>
              </div>
            ) : null}
          </div>
        </div>

        {isStaff ? (
          <>
            <div className="sheet p-6">
              <h2 className="font-serif text-lg text-ink">What they planned</h2>
              {!plan ? (
                <p className="mt-2 text-sm text-muted">The trainee hasn&apos;t started a lesson plan for this TP yet.</p>
              ) : (
                <>
                  {!plan.submitted_at ? (
                    <p className="mt-2 text-sm text-muted">Not submitted yet -- shown here as a live draft.</p>
                  ) : null}
                  <div className="mt-4 flex flex-col gap-3">
                    <ReadOnlyField label="Main Aims" value={plan.main_aims} />
                    <ReadOnlyField label="Subsidiary Aims" value={plan.subsidiary_aims} />
                    <ReadOnlyField label="Personal Aims" value={plan.personal_aims} />
                    <ReadOnlyField label="Class Profile" value={plan.class_profile} />
                    <ReadOnlyField label="Materials description" value={plan.materials_description} />
                    {plan.anticipated_problems.length > 0 ? (
                      <div>
                        <p className="text-sm text-muted">Anticipated problems & solutions</p>
                        <ul className="mt-1 flex flex-col gap-1">
                          {plan.anticipated_problems.map((p, i) =>
                            p.problem || p.solution ? (
                              <li key={i} className="text-ink">
                                <b>Problem:</b> {p.problem} <b>Solution:</b> {p.solution}
                              </li>
                            ) : null
                          )}
                        </ul>
                      </div>
                    ) : null}
                    {plan.procedure.length > 0 ? (
                      <div>
                        <p className="text-sm text-muted">Procedure</p>
                        <table className="mt-2 w-full min-w-[700px] border-collapse text-sm">
                          <thead>
                            <tr>
                              <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Stage</th>
                              <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Procedure</th>
                              <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Interaction</th>
                              <th className="border-b border-border-faint p-2 text-left text-xs text-muted">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.procedure.map((row, i) => (
                              <tr key={i}>
                                <td className="border-b border-border-faint p-2 align-top text-ink">{row.stage}</td>
                                <td className="border-b border-border-faint p-2 align-top whitespace-pre-line text-ink">
                                  {row.procedure}
                                </td>
                                <td className="border-b border-border-faint p-2 align-top text-ink">{row.interaction}</td>
                                <td className="border-b border-border-faint p-2 align-top text-ink">{row.time}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {languageAnalysis ? (
              <div className="sheet p-6">
                <h2 className="font-serif text-lg text-ink">Language Analysis ({languageAnalysis.type})</h2>
                {languageAnalysis.context ? <p className="mt-1 text-sm text-ink">{languageAnalysis.context}</p> : null}
                {languageAnalysis.type === "vocab" ? (
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {languageAnalysis.vocab_rows.map((row, i) => (
                      <li key={i} className="text-ink">
                        <b>{row.item}</b> -- {row.definition}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {languageAnalysis.blocks.map((block, i) => (
                      <div key={i} className="text-sm text-ink">
                        <p className="font-medium">{block.item}</p>
                        {block.meaning ? <p className="text-muted">{block.meaning}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {materials && materials.length > 0 ? (
              <div className="sheet p-6">
                <h2 className="font-serif text-lg text-ink">Materials</h2>
                <ul className="mt-2 flex flex-col gap-2 text-sm text-ink">
                  {materials.map((m) => {
                    const shared = sharedMaterialIds.has(m.id);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3">
                        <span>{m.file_name ?? m.slides_url}</span>
                        {isEditableStaff ? (
                          <form action={shared ? unshareMaterialWithStudents : shareMaterialWithStudents}>
                            <input type="hidden" name="tp_material_id" value={m.id} />
                            <input type="hidden" name="trainee_id" value={traineeId} />
                            <input type="hidden" name="tp_number" value={tpNumber} />
                            <button
                              type="submit"
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                shared
                                  ? "border-status-on-track-text/30 bg-status-on-track-bg text-status-on-track-text"
                                  : "border-border text-muted hover:border-primary hover:text-primary"
                              }`}
                            >
                              {shared ? "Shared with students ✓" : "Share with students"}
                            </button>
                          </form>
                        ) : shared ? (
                          <span className="rounded-full border border-status-on-track-text/30 bg-status-on-track-bg px-2.5 py-1 text-xs font-medium text-status-on-track-text">
                            Shared with students ✓
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="sheet p-6">
              <h2 className="font-serif text-lg text-ink">Self-evaluation</h2>
              {selfEvaluation?.submitted_at ? (
                <div className="mt-3 flex flex-col gap-3">
                  <ReadOnlyField label="What went to plan?" value={selfEvaluation.what_went_well} />
                  <ReadOnlyField label="What didn't go as planned, and why?" value={selfEvaluation.what_not_as_planned} />
                  <ReadOnlyField label="Evidence of learning" value={selfEvaluation.evidence_of_learning} />
                  <ReadOnlyField label="What I'd do differently" value={selfEvaluation.what_differently} />
                  <ReadOnlyField label="Focus for next TP" value={selfEvaluation.next_tp_focus} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">Not submitted yet.</p>
              )}
            </div>

            {plan && (isEditableStaff || feedback?.submitted_at) ? (
              <FeedbackForm planId={plan.id} traineeId={traineeId} tpNumber={tpNumber} feedback={feedback ?? null} />
            ) : plan ? (
              <div className="sheet p-6">
                <h2 className="font-serif text-lg text-ink">Tutor feedback</h2>
                <p className="mt-2 text-sm text-muted">Not yet submitted.</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <LessonPlanForm tpNumber={tpNumber} plan={plan} languageAnalysis={languageAnalysis ?? null} />

            {plan ? (
              <MaterialsSection
                tpPlanId={plan.id}
                centerId={trainee.center_id}
                traineeId={traineeId}
                materials={materials ?? []}
                locked={Boolean(plan.submitted_at)}
                hasGoogleConnection={hasGoogleConnection}
              />
            ) : (
              <div className="sheet p-6">
                <h2 className="font-serif text-lg text-ink">Materials</h2>
                <p className="mt-2 text-sm text-muted">Save your lesson plan first -- materials attach to it once it exists.</p>
              </div>
            )}

            <SelfEvaluationSection
              tpNumber={tpNumber}
              plan={plan ?? null}
              taught={Boolean(assignment.taught_at)}
              selfEvaluation={selfEvaluation ?? null}
              previousActionPoints={previousActionPoints}
              feedback={feedback ?? null}
            />
          </>
        )}
      </div>

      <div className="sheet h-fit lg:sticky lg:top-6">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Criteria evidenced</p>
        <p className="mt-1 text-xs text-muted">Criteria your tutor confirmed in this lesson&apos;s feedback.</p>
        {criteriaCodes.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-3">
            {criteriaCodes.map((code) => (
              <li key={code}>
                <p className="text-xs font-semibold tracking-wide text-ink uppercase">{code}</p>
                <p className="text-xs text-muted">{CRITERIA_LABELS[code]}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {feedback?.submitted_at ? "No criteria tagged in this lesson's feedback." : "Shows once your tutor releases feedback."}
          </p>
        )}
      </div>
    </div>
  );
}
