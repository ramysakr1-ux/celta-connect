import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import {
  DENSITY_TIER_LABELS,
  ABBREVIATIONS_GLOSSARY,
  PLANNING_TIPS,
  TEACHING_TIPS,
  showsAbbreviationsGlossary,
  showsTips,
} from "@/lib/tp-density";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import {
  TP_LESSON_LENGTH_MINUTES,
  getTpCardStatus,
  sumProcedureMinutes,
  type FeedbackPoint,
  type TpCardStatus,
} from "@/lib/tp-plan-content";
import { LessonPlanForm } from "@/app/dashboard/trainee/plan/[tpNumber]/lesson-plan-form";
import { MaterialsSection } from "@/app/dashboard/trainee/plan/[tpNumber]/materials-section";
import { SelfEvaluationSection } from "@/app/dashboard/trainee/plan/[tpNumber]/self-evaluation-section";
import { FeedbackForm } from "@/app/dashboard/trainer/trainees/[id]/tp/[tpNumber]/feedback-form";
import { shareMaterialWithStudents, unshareMaterialWithStudents } from "@/app/portfolio/[traineeId]/tp/[tpNumber]/share-actions";
import { getPeerGroupMembers } from "@/lib/peer-observation";
import { PeerNoteForm } from "@/app/portfolio/[traineeId]/tp/[tpNumber]/peer-note-form";
import { GroupFeedbackForm } from "@/app/portfolio/[traineeId]/tp/[tpNumber]/group-feedback-form";
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
  const admin = createAdminClient();
  // A trainee who isn't the page owner is only ever allowed in as a peer
  // observer (one of the other five in that candidate's TP group) -- never
  // as a general viewer of someone else's plan/feedback/self-eval.
  let isPeerObserver = false;
  if (viewer && !isRealStaff && viewer.id !== traineeId) {
    const group = await getPeerGroupMembers(admin, traineeId);
    if (group.some((m) => m.traineeId === viewer.id)) {
      isPeerObserver = true;
    } else {
      notFound();
    }
  }
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

  // Ramy, 25 Aug 2026: "the trainees also should know... maybe it will show
  // on their TP cards" -- aggregate volunteer count for the calendar round
  // this TP number maps to. Admin client throughout: volunteer_declines'
  // RLS has no trainee policy (0143_volunteer_declines.sql), and this page
  // already uses `admin` for peer-observation reads above.
  let volunteerAttendance: { expected: number; total: number } | null = null;
  if (trainee.course_id) {
    const { data: tpCalendarEvent } = await admin
      .from("course_timetable_events")
      .select("id")
      .eq("course_id", trainee.course_id)
      .eq("type", "tp")
      .eq("linked_tp_number", tpNumber)
      .maybeSingle();
    if (tpCalendarEvent) {
      const { data: courseVolunteers } = await admin.from("volunteer_students").select("id").eq("course_id", trainee.course_id).is("removed_at", null);
      const courseVolunteerIds = (courseVolunteers ?? []).map((v) => v.id);
      if (courseVolunteerIds.length > 0) {
        const { data: declines } = await admin
          .from("volunteer_declines")
          .select("volunteer_student_id")
          .eq("timetable_event_id", tpCalendarEvent.id)
          .in("volunteer_student_id", courseVolunteerIds);
        volunteerAttendance = { total: courseVolunteerIds.length, expected: courseVolunteerIds.length - (declines?.length ?? 0) };
      }
    }
  }

  // specs/build-spec.md "Peer observation" -- a peer only ever sees this
  // one panel for someone else's lesson, never their plan, self-eval, or
  // tutor feedback. Returns early, before any of those get fetched.
  if (isPeerObserver) {
    const { data: sheet } = await admin
      .from("peer_observation_sheets")
      .select("id, prompt_1, prompt_2, revealed_at")
      .eq("trainee_id", traineeId)
      .eq("tp_number", tpNumber)
      .maybeSingle();
    const { data: myNote } = sheet
      ? await admin
          .from("peer_observation_notes")
          .select("note_1, note_2")
          .eq("sheet_id", sheet.id)
          .eq("observer_id", viewer!.id)
          .maybeSingle()
      : { data: null };

    return (
      <div className="flex flex-col gap-4">
        <Link href={`/portfolio/${traineeId}/tp`} className="text-sm text-muted hover:text-primary">
          ← All teaching practices
        </Link>
        <div className="sheet p-6">
          <h1 className="font-serif text-xl text-ink">{trainee.full_name} — TP{tpNumber}</h1>
          <p className="mt-1 text-sm text-muted">Peer observation</p>
        </div>
        <div className="sheet p-6">
          {!sheet || !sheet.revealed_at ? (
            <PeerNoteForm
              traineeId={traineeId}
              tpNumber={tpNumber}
              prompt1={sheet?.prompt_1 ?? "What's one strength you noticed?"}
              prompt2={sheet?.prompt_2 ?? "Anything else worth flagging?"}
              initialNote1={myNote?.note_1 ?? ""}
              initialNote2={myNote?.note_2 ?? ""}
            />
          ) : (
            <div>
              <p className="text-sm text-muted">Notes have been revealed -- read them together, then agree the group feedback.</p>
              <GroupFeedbackForm traineeId={traineeId} tpNumber={tpNumber} initialFeedback="" />
            </div>
          )}
        </div>
      </div>
    );
  }

  const [{ data: assignment }, { data: plan }, { data: googleConnection }, { data: center }] = await Promise.all([
    supabase.from("plan_assignments").select("*").eq("trainee_id", traineeId).eq("tp_number", tpNumber).maybeSingle(),
    supabase.from("tp_plans").select("*").eq("trainee_id", traineeId).eq("tp_number", tpNumber).maybeSingle(),
    admin.from("center_google_connections").select("center_id").eq("center_id", trainee.center_id).maybeSingle(),
    admin.from("centers").select("auto_tag_criteria_enabled").eq("id", trainee.center_id).maybeSingle(),
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

  // "From your peers" -- read only once revealed, and only through the
  // admin client (this viewer is the observed candidate or staff, never
  // one of the individual observers, so the notes: observer-owns-row RLS
  // policy would otherwise show nothing here even post-reveal).
  const { data: peerSheet } = await admin
    .from("peer_observation_sheets")
    .select("id, revealed_at, group_feedback")
    .eq("trainee_id", traineeId)
    .eq("tp_number", tpNumber)
    .maybeSingle();
  const { data: peerNotes } = peerSheet?.revealed_at
    ? await admin.from("peer_observation_notes").select("note_1, note_2").eq("sheet_id", peerSheet.id)
    : { data: [] };

  const [{ data: languageAnalysis }, { data: materials }, { data: selfEvaluation }, { data: feedback }] = plan
    ? await Promise.all([
        supabase.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
        supabase.from("tp_materials").select("*").eq("tp_plan_id", plan.id).order("created_at"),
        supabase.from("tp_self_evaluations").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
        supabase.from("tp_feedback").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
      ])
    : [{ data: null }, { data: [] }, { data: null }, { data: null }];

  let previousActionPoints: string[] = [];
  // Personal Aims' own carried suggestion is planning-scoped only (a
  // "what to work on" for how the trainee designs the lesson, not the
  // teaching-scope points self-evaluation already carries) -- just the
  // first starred one, since the field shows one tap-to-use suggestion,
  // not a list.
  let previousPlanningActionPoint: string | null = null;
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
      const planningPoints = (previousFeedback?.action_points_planning ?? []).filter((p) => p.starred);
      previousActionPoints = [
        ...planningPoints,
        ...(previousFeedback?.action_points_teaching ?? []).filter((p) => p.starred),
      ].map((p) => p.text);
      previousPlanningActionPoint = planningPoints[0]?.text ?? null;
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
            <p className="mt-1 text-sm text-muted">
              {densityLabel.name}
              {volunteerAttendance ? ` · ${volunteerAttendance.expected} of ${volunteerAttendance.total} volunteers coming` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {(() => {
              const exportReady = Boolean(plan?.submitted_at && selfEvaluation?.submitted_at && feedback?.submitted_at);
              return exportReady ? (
                <a
                  href={`/api/tp-plans/${plan!.id}/pdf`}
                  className="flex items-center gap-1.5 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover-fill"
                >
                  Export TP PDF
                </a>
              ) : (
                <span
                  className="cursor-not-allowed rounded-[6px] border border-border px-3 py-1.5 text-sm text-muted"
                  title="Available once the plan, self-evaluation and feedback are all submitted"
                >
                  Export TP PDF
                </span>
              );
            })()}
            <span className={`pill ${TONE_PILL_CLASS[status.tone]}`}>{status.label}</span>
          </div>
        </div>

        {!isStaff && bannerMessage ? (
          <div className="sheet flex items-center gap-2 border-primary/20 bg-accent/30 text-sm text-ink">
            <span aria-hidden="true">🔒</span>
            {bannerMessage}
          </div>
        ) : null}

        <nav className="sheet flex items-center gap-1 !p-1.5">
          {[
            { key: "brief", label: "Brief" },
            { key: "plan", label: "Plan" },
            { key: "analysis", label: "Language analysis" },
            { key: "materials", label: "Materials", badge: materials && materials.length > 0 ? String(materials.length) : null },
            { key: "self", label: "Self-evaluation", badge: selfEvaluation?.submitted_at ? "✓" : null },
          ].map((item) => (
            <a
              key={item.key}
              href={`#${item.key}`}
              className="flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-accent/40 hover:text-ink"
            >
              {item.label}
              {item.badge ? (
                <span className="flex min-w-[16px] items-center justify-center rounded-full bg-surface-muted px-1 py-0.5 text-[10px] font-bold text-muted">
                  {item.badge}
                </span>
              ) : null}
            </a>
          ))}
        </nav>

        <div id="brief" className="sheet scroll-mt-20 p-6">
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

          {showsAbbreviationsGlossary(tier) || showsTips(tier) ? (
            <div className="mt-5 flex flex-col gap-4 border-t border-border-faint pt-4">
              {showsAbbreviationsGlossary(tier) ? (
                <div>
                  <p className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Abbreviations</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {ABBREVIATIONS_GLOSSARY.map((a) => (
                      <span key={a.abbr} className="text-xs text-muted">
                        <span className="font-semibold text-ink">{a.abbr}</span> -- {a.meaning}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {showsTips(tier) ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Planning tips</p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {PLANNING_TIPS.map((tip) => (
                        <li key={tip} className="text-xs text-muted">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Teaching tips</p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {TEACHING_TIPS.map((tip) => (
                        <li key={tip} className="text-xs text-muted">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {isStaff ? (
          <>
            <div id="plan" className="sheet scroll-mt-20 p-6">
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
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <colgroup>
                              <col className="w-[116px]" />
                              <col />
                              <col className="w-[74px]" />
                              <col className="w-[52px]" />
                            </colgroup>
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
                        {(() => {
                          const total = sumProcedureMinutes(plan.procedure);
                          const overBy = total - TP_LESSON_LENGTH_MINUTES;
                          return (
                            <div className="mt-1.5 flex items-center justify-between gap-3">
                              <span className="text-xs text-muted">
                                {plan.procedure.length} stages · {total} minutes planned for a {TP_LESSON_LENGTH_MINUTES} minute lesson
                              </span>
                              {overBy > 0 ? (
                                <span className="text-xs font-semibold text-status-warning-text">Over by {overBy} min</span>
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {languageAnalysis ? (
              <div id="analysis" className="sheet scroll-mt-20 p-6">
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
              <div id="materials" className="sheet scroll-mt-20 p-6">
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
                                  ? "border-border bg-status-neutral-bg text-ink"
                                  : "border-border text-muted trainee-hover-fill hover:text-primary"
                              }`}
                            >
                              {shared ? "Shared with students ✓" : "Share with students"}
                            </button>
                          </form>
                        ) : shared ? (
                          <span className="rounded-full border border-border bg-status-neutral-bg px-2.5 py-1 text-xs font-medium text-ink">
                            Shared with students ✓
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div id="self" className="sheet scroll-mt-20 p-6">
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
              <FeedbackForm
                planId={plan.id}
                traineeId={traineeId}
                tpNumber={tpNumber}
                feedback={feedback ?? null}
                selfEvaluation={selfEvaluation ?? null}
                autoTagEnabled={center?.auto_tag_criteria_enabled ?? true}
              />
            ) : plan ? (
              <div className="sheet p-6">
                <h2 className="font-serif text-lg text-ink">Tutor feedback</h2>
                <p className="mt-2 text-sm text-muted">Not yet submitted.</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <LessonPlanForm
              tpNumber={tpNumber}
              plan={plan}
              languageAnalysis={languageAnalysis ?? null}
              previousPlanningActionPoint={previousPlanningActionPoint}
            />

            <div id="materials" className="scroll-mt-20">
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
                <div className="sheet rounded-[9px] border-t-[var(--trainee-plum)] p-6">
                  <h2 className="font-serif text-lg text-ink">Materials</h2>
                  <p className="mt-2 text-sm text-muted">Save your lesson plan first -- materials attach to it once it exists.</p>
                </div>
              )}
            </div>

            <div id="self" className="scroll-mt-20">
              <SelfEvaluationSection
                tpNumber={tpNumber}
                plan={plan ?? null}
                taught={Boolean(assignment.taught_at)}
                selfEvaluation={selfEvaluation ?? null}
                previousActionPoints={previousActionPoints}
                feedback={feedback ?? null}
              />
            </div>
          </>
        )}

        {peerSheet?.revealed_at && (peerNotes ?? []).length > 0 ? (
          <div className="sheet p-6">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">From your peers</p>
            <p className="mt-1 text-xs text-muted">
              Not a Cambridge document -- kept out of the portfolio, CELTA5, and the assessor pack.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {(peerNotes ?? []).map((n, i) => (
                <li key={i} className="rounded-[6px] border border-border-faint p-2.5 text-sm text-ink">
                  {n.note_1 ? <p>{n.note_1}</p> : null}
                  {n.note_2 ? <p>{n.note_2}</p> : null}
                </li>
              ))}
            </ul>
            {peerSheet.group_feedback ? (
              <div className="mt-3 border-t border-border-faint pt-3">
                <p className="text-xs font-semibold text-muted uppercase">Group feedback</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">{peerSheet.group_feedback}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sheet h-fit p-6 lg:sticky lg:top-6">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          Criteria evidenced{criteriaCodes.length > 0 ? ` · ${criteriaCodes.length}` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">Fills as your tutor tags criteria in this lesson&apos;s feedback.</p>
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
