import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId, getPortfolioViewer } from "@/lib/auth/portfolio-access";
import { formatCalendarDate } from "@/lib/format-date";
import { STANDARD_RATING_OPTIONS } from "@/lib/celta-criteria";
import {
  ANALYSIS_SHEETS,
  TP_LESSON_LENGTH_MINUTES,
  anchorBelongsToAnalysis,
  anchorBelongsToPlan,
  sumProcedureMinutes,
  timeValue,
  type FeedbackPoint,
} from "@/lib/tp-plan-content";
import { PrintButton } from "@/app/tp-document/[traineeId]/[tpNumber]/print-button";

export const dynamic = "force-dynamic";

// design_handoff_tp_feedback_cycle §3 — the assembled document, the thing the
// trainee finally receives.
//
// Deliberately OUTSIDE /portfolio: that route group's layout wraps every page
// in the candidate's workspace rail and the staff roster chrome, and all of it
// would have printed around the document. A layout cannot be removed by a
// child, so the document lives at its own top-level route and carries its own
// access check (the same one the portfolio uses: a real session, or a live
// assessor token scoped to this course).
//
// The thing the trainee finally receives: feedback cover → lesson plan → language analysis →
// self-evaluation, each opening with a full-bleed band in its role colour.
//
// Deliberately NOT a replacement for /api/tp-plans/[planId]/pdf yet. That
// endpoint merges the candidate's own uploaded handouts into the download with
// pdf-lib, which only works because its base is a real PDF; an HTML print page
// cannot append someone's PDF attachment. So this is the designed document and
// that endpoint still produces the merged file. Which one survives is Ramy's
// call, and it is one line either way.
//
// Anchored planning points print TWICE, which is the point of the anchor added
// to FeedbackPoint: once on the cover under Planning, and again beside the
// part of the plan or the analysis they were written against.

const SHEET = "oklch(99.2% 0.005 90)";
const INK = "oklch(23.5% 0.017 65)";
const INK_WARM = "oklch(30% 0.042 58)";
const MUTED = "oklch(51% 0.017 70)";
const TEAL = "oklch(37.5% 0.058 195)";
const GOLD = "oklch(63% 0.096 72)";
const GOLD_INK = "oklch(44% 0.095 68)";
const GOLD_WASH = "oklch(94.5% 0.065 85)";
const GARNET = "oklch(42% 0.13 27)";
const BORDER = "oklch(88% 0.016 82)";
const FAINT = "oklch(91.2% 0.0152 83)";
const CARD = "oklch(96.4% 0.014 85)";
const ZEBRA = "oklch(97.6% 0.01 88)";

const BANDS = {
  feedback: { fill: TEAL, eyebrow: "oklch(84% 0.05 195)" },
  plan: { fill: INK_WARM, eyebrow: "oklch(79% 0.06 78)" },
  la: { fill: GOLD_INK, eyebrow: "oklch(90% 0.06 80)", sub: "oklch(92% 0.05 80)" },
  selfEval: { fill: GARNET, eyebrow: "oklch(86% 0.06 40)" },
};

const STAGE_HUES = [TEAL, GOLD_INK, INK_WARM, INK_WARM, GARNET, MUTED, TEAL];

const SELF_EVAL_QUESTIONS = [
  { key: "what_went_well", label: "What went to plan?", hue: TEAL },
  { key: "what_not_as_planned", label: "What didn't go as planned, and why?", hue: GARNET },
  { key: "evidence_of_learning", label: "What evidence did you see that the learners had learnt?", hue: INK_WARM },
  { key: "what_differently", label: "What would you do differently if you taught it again?", hue: GOLD_INK },
] as const;

export default async function AssembledDocumentPage({
  params,
}: {
  params: Promise<{ traineeId: string; tpNumber: string }>;
}) {
  const { traineeId, tpNumber: tpParam } = await params;
  const tpNumber = Number(tpParam);
  if (!Number.isFinite(tpNumber)) notFound();

  const session = await getPortfolioViewer();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, full_name, course_id, center_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const [{ data: plan }, { data: assignment }, { data: course }, { data: centre }] = await Promise.all([
    supabase.from("tp_plans").select("*").eq("trainee_id", traineeId).eq("tp_number", tpNumber).maybeSingle(),
    supabase.from("plan_assignments").select("main_lesson_aim").eq("trainee_id", traineeId).eq("tp_number", tpNumber).maybeSingle(),
    trainee.course_id ? supabase.from("courses").select("name").eq("id", trainee.course_id).maybeSingle() : Promise.resolve({ data: null }),
    trainee.center_id ? supabase.from("centers").select("name").eq("id", trainee.center_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!plan) notFound();

  const [{ data: languageAnalysis }, { data: selfEvaluation }, { data: feedback }] = await Promise.all([
    supabase.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
    supabase.from("tp_self_evaluations").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
    supabase.from("tp_feedback").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
  ]);

  const { data: tutor } = feedback?.trainer_id
    ? await supabase.from("profiles").select("full_name").eq("id", feedback.trainer_id).maybeSingle()
    : { data: null };

  const gradeLabel = STANDARD_RATING_OPTIONS.find((o) => o.value === feedback?.grade)?.label ?? null;
  const procedure = plan.procedure ?? [];
  const problems = (plan.anticipated_problems ?? []).filter((p) => p.problem || p.solution);
  const vocabRows = languageAnalysis?.vocab_rows ?? [];
  const laBlocks = languageAnalysis?.blocks ?? [];
  const laHasContent = Boolean(languageAnalysis && (languageAnalysis.context || vocabRows.length > 0 || laBlocks.length > 0));

  const planningStrengths = feedback?.strengths_planning ?? [];
  const planningActions = feedback?.action_points_planning ?? [];
  const allPlanning = [...planningStrengths, ...planningActions];
  const anchoredToPlan = allPlanning.filter((p) => anchorBelongsToPlan(p.anchor) && p.text.trim());
  const anchoredToLa = allPlanning.filter((p) => anchorBelongsToAnalysis(p.anchor) && p.text.trim());

  const total = sumProcedureMinutes(procedure);
  const overBy = total - TP_LESSON_LENGTH_MINUTES;
  const hueFor = (i: number) => (plan.framework_used ? STAGE_HUES[i % STAGE_HUES.length] : BORDER);

  const footerLeft = [trainee.full_name, course?.name, centre?.name].filter(Boolean).join(" · ");
  const lessonTitle = assignment?.main_lesson_aim ?? plan.main_aims ?? "";
  const submittedOn = plan.submitted_at ? formatCalendarDate(plan.submitted_at.slice(0, 10), { day: "numeric", month: "long", year: "numeric" }) : "";
  const footerRight = [`TP${tpNumber}`, lessonTitle.slice(0, 60), submittedOn].filter(Boolean).join(" · ");

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0.7in; }
        @media print {
          .doc-chrome { display: none !important; }
          .doc-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
          .band-break { break-before: page; }
        }
        .keep { break-inside: avoid; }
        .doc-sheet ul { margin: 0; padding-left: 14pt; }
      `}</style>

      <div className="doc-chrome flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase" style={{ color: MUTED }}>
            Assembled document
          </p>
          <p className="text-sm" style={{ color: INK }}>
            {trainee.full_name} · TP{tpNumber}
          </p>
        </div>
        <PrintButton />
      </div>

      <div
        className="doc-sheet mx-auto"
        style={{
          maxWidth: 900,
          background: SHEET,
          color: INK,
          fontSize: "11pt",
          lineHeight: 1.5,
          padding: "0.7in",
          boxShadow: "0 18px 44px oklch(23.5% 0.017 65 / 0.12)",
        }}
      >
        {/* ============ 1. Feedback ============ */}
        <Band
          fill={BANDS.feedback.fill}
          eyebrow={[`Teaching Practice ${tpNumber}`, submittedOn].filter(Boolean).join(" · ")}
          eyebrowColour={BANDS.feedback.eyebrow}
          title={
            <>
              Tutor feedback <i style={{ color: BANDS.feedback.eyebrow }}>for</i> {trainee.full_name}
            </>
          }
          titleSize="26pt"
        >
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {gradeLabel ? (
              <span
                className="inline-flex items-center gap-2 rounded-full"
                style={{ background: SHEET, padding: "5pt 13pt", fontSize: "10pt", fontWeight: 700, color: TEAL }}
              >
                <span style={{ width: "6pt", height: "6pt", borderRadius: "50%", background: TEAL, display: "inline-block" }} />
                {gradeLabel}
              </span>
            ) : null}
            <span style={{ fontSize: "9.5pt", color: BANDS.feedback.eyebrow }}>
              {[tutor?.full_name ? `Tutor: ${tutor.full_name}` : null, lessonTitle].filter(Boolean).join(" · ")}
            </span>
          </div>
        </Band>

        <div className="mt-5 grid grid-cols-2 gap-x-6">
          <PointColumn
            glyph="P"
            title="Planning"
            hue={INK_WARM}
            strengths={planningStrengths}
            actions={planningActions}
          />
          <PointColumn
            glyph="T"
            title="Teaching"
            hue={GARNET}
            strengths={feedback?.strengths_teaching ?? []}
            actions={feedback?.action_points_teaching ?? []}
          />
        </div>

        {feedback?.overall_comment ? (
          <div className="keep mt-5">
            <Marker colour={INK_WARM} label="Overall comment" />
            <p
              className="mt-1.5 font-serif"
              style={{ borderLeft: `2px solid ${INK_WARM}`, paddingLeft: "12pt", fontSize: "12pt", lineHeight: 1.55, whiteSpace: "pre-line" }}
            >
              {feedback.overall_comment}
            </p>
          </div>
        ) : null}
        <p className="mt-3" style={{ fontSize: "9pt", color: MUTED }}>
          ★ Starred action points carry into the Personal Aims of your TP{tpNumber + 1} plan.
        </p>

        {/* ============ 2. Lesson plan ============ */}
        <div className="band-break">
          <Band
            fill={BANDS.plan.fill}
            eyebrow={`Teaching Practice ${tpNumber}`}
            eyebrowColour={BANDS.plan.eyebrow}
            title="Lesson plan"
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <AimBlock label="Main aims" colour={TEAL} value={plan.main_aims} />
          <AimBlock label="Subsidiary aims" colour={INK_WARM} value={plan.subsidiary_aims} />
          <AimBlock label="Personal aims" colour={GOLD_INK} value={plan.personal_aims} />
        </div>

        {procedure.length > 0 ? (
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-serif" style={{ fontSize: "15pt", fontWeight: 600, color: INK_WARM }}>
                Procedure
              </h3>
              <span style={{ fontSize: "9.5pt", color: MUTED }}>
                {total} of {TP_LESSON_LENGTH_MINUTES} min ·{" "}
                <span style={{ fontWeight: 700, color: overBy > 0 ? GOLD_INK : TEAL }}>
                  {overBy > 0 ? `over by ${overBy} min` : overBy === 0 ? "fits exactly" : `${-overBy} min spare`}
                </span>
              </span>
            </div>
            <div className="mt-1.5 flex gap-[2px]" style={{ height: "5pt" }}>
              {procedure.map((row, i) => (
                <span
                  key={i}
                  style={{
                    flex: Math.max(1, timeValue(row.time)),
                    borderRadius: "2pt",
                    background: row.procedure.trim() ? hueFor(i) : FAINT,
                  }}
                />
              ))}
            </div>

            <div className="mt-2">
              {procedure.map((row, i) => (
                <div
                  key={i}
                  className="keep grid gap-3"
                  style={{ gridTemplateColumns: "22pt 150pt 1fr", borderTop: `1px solid ${FAINT}`, padding: "7pt 0" }}
                >
                  <span
                    className="flex items-center justify-center rounded-full"
                    style={{ width: "18pt", height: "18pt", background: hueFor(i), color: SHEET, fontSize: "9pt", fontWeight: 700 }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-serif" style={{ fontSize: "11.5pt", fontWeight: 600, color: INK }}>
                      {row.stage}
                    </p>
                    {row.aim ? (
                      <p className="italic" style={{ fontSize: "9pt", color: MUTED }}>
                        {row.aim}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.time ? (
                        <span
                          style={{
                            borderRadius: "3pt",
                            background: `color-mix(in oklab, ${hueFor(i)} 13%, transparent)`,
                            color: hueFor(i),
                            padding: "1pt 5pt",
                            fontSize: "8.5pt",
                            fontWeight: 700,
                          }}
                        >
                          {timeValue(row.time)}′
                        </span>
                      ) : null}
                      {row.interaction
                        .split(/[,+]/)
                        .map((c) => c.trim())
                        .filter(Boolean)
                        .map((code) => (
                          <span
                            key={code}
                            style={{ borderRadius: "3pt", border: `1px solid ${BORDER}`, padding: "1pt 5pt", fontSize: "8.5pt", fontWeight: 600, color: INK_WARM }}
                          >
                            {code}
                          </span>
                        ))}
                    </div>
                  </div>
                  <p style={{ borderLeft: `1px solid ${FAINT}`, paddingLeft: "10pt", fontSize: "10pt", whiteSpace: "pre-line" }}>
                    {row.procedure}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {problems.length > 0 || plan.class_profile || plan.materials_description ? (
          <div className="keep mt-4 grid grid-cols-2 gap-4" style={{ borderRadius: "6pt", background: CARD, padding: "10pt 12pt" }}>
            <div>
              <Marker colour={GARNET} label="Anticipated problems & solutions" />
              <div className="mt-1.5">
                {problems.map((p, i) => (
                  <p key={i} style={{ fontSize: "9.5pt", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: GARNET }}>{i + 1} </span>
                    {p.problem} <span style={{ color: TEAL }}>→</span> {p.solution}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {plan.class_profile ? (
                <div>
                  <Marker colour={TEAL} label="Class profile" />
                  <p className="mt-1" style={{ fontSize: "9.5pt", whiteSpace: "pre-line" }}>
                    {plan.class_profile}
                  </p>
                </div>
              ) : null}
              {plan.materials_description ? (
                <div>
                  <Marker colour={TEAL} label="Materials" />
                  <p className="mt-1" style={{ fontSize: "9.5pt", whiteSpace: "pre-line" }}>
                    {plan.materials_description}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {anchoredToPlan.length > 0 ? (
          <AnchoredComments title="Tutor's comment on this plan" points={anchoredToPlan} stageNames={procedure.map((r) => r.stage)} vocabItems={vocabRows.map((r) => r.item)} />
        ) : null}

        {/* ============ 3. Language analysis ============ */}
        {laHasContent ? (
          <>
            <div className="band-break">
              <Band
                fill={BANDS.la.fill}
                eyebrow={`Teaching Practice ${tpNumber}`}
                eyebrowColour={BANDS.la.eyebrow}
                title="Language analysis"
                subLine={languageAnalysis?.context ?? undefined}
                subColour={BANDS.la.sub}
              />
            </div>

            {vocabRows.length > 0 ? (
              <table className="mt-4 w-full border-collapse" style={{ fontSize: "9pt" }}>
                <thead>
                  <tr style={{ background: CARD }}>
                    {[
                      ["Vocab item", "stress, transcription, part of speech", "16%"],
                      ["Definition", "level appropriate", "17%"],
                      ["How you convey it", "situation, picture, realia", "17%"],
                      ["Clarification", "visuals, CCQs, examples", "20%"],
                      ["Form", "countable? collocations", "14%"],
                      ["Problems & solutions", "meaning, form, pronunciation", "16%"],
                    ].map(([label, hint, width]) => (
                      <th key={label} className="text-left align-top" style={{ width, padding: "5pt 6pt", borderBottom: `1.5px solid ${GOLD_INK}` }}>
                        <span style={{ fontSize: "8.5pt", fontWeight: 700, color: INK_WARM }}>{label}</span>
                        <span className="block italic" style={{ fontSize: "7.5pt", fontWeight: 400, color: MUTED }}>
                          {hint}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vocabRows.map((row, i) => (
                    <tr key={i} className="keep" style={{ background: i % 2 ? ZEBRA : undefined }}>
                      {(["item", "definition", "convey", "clarification", "form", "problems"] as const).map((k, ci) => (
                        <td
                          key={k}
                          className="align-top"
                          style={{
                            padding: "5pt 6pt",
                            borderBottom: `1px solid ${FAINT}`,
                            color: ci === 0 ? INK : INK_WARM,
                            fontWeight: ci === 0 ? 600 : 400,
                            whiteSpace: "pre-line",
                          }}
                        >
                          {row[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {laBlocks.map((block, i) => {
              const sheet = languageAnalysis && languageAnalysis.type !== "vocab" ? ANALYSIS_SHEETS[languageAnalysis.type] : null;
              if (!sheet) return null;
              return (
                <div key={i} className="keep mt-4" style={{ borderRadius: "6pt", border: `1px solid ${FAINT}`, padding: "10pt 12pt" }}>
                  <h4 className="font-serif" style={{ fontSize: "12pt", fontWeight: 600, color: INK }}>
                    {sheet.blockName} {i + 1}
                    {block.item ? ` · ${block.item}` : ""}
                  </h4>
                  {sheet.fields.map((field) => {
                    const value = block[field.key];
                    if (field.type === "pairs") {
                      const pairs = (value as { problem: string; solution: string }[] | undefined) ?? [];
                      if (pairs.length === 0) return null;
                      return (
                        <div key={String(field.key)} className="mt-1.5">
                          <p style={{ fontSize: "8.5pt", fontWeight: 600, color: INK_WARM }}>{field.label}</p>
                          {pairs.map((pair, pi) => (
                            <p key={pi} style={{ fontSize: "9.5pt" }}>
                              {pair.problem} <span style={{ color: TEAL }}>→</span> {pair.solution}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    const text = (value as string | undefined) ?? "";
                    if (!text) return null;
                    return (
                      <div key={String(field.key)} className="mt-1.5">
                        <p style={{ fontSize: "8.5pt", fontWeight: 600, color: INK_WARM }}>{field.label}</p>
                        <p style={{ fontSize: "9.5pt", whiteSpace: "pre-line" }}>{text}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {anchoredToLa.length > 0 ? (
              <AnchoredComments
                title="Tutor's comment on the language analysis"
                points={anchoredToLa}
                stageNames={procedure.map((r) => r.stage)}
                vocabItems={vocabRows.map((r) => r.item)}
              />
            ) : null}
          </>
        ) : null}

        {/* ============ 4. Self-evaluation ============ */}
        {selfEvaluation ? (
          <>
            <div className="band-break">
              <Band
                fill={BANDS.selfEval.fill}
                eyebrow={`Teaching Practice ${tpNumber}`}
                eyebrowColour={BANDS.selfEval.eyebrow}
                title="Self-evaluation"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              {SELF_EVAL_QUESTIONS.map((q, i) => {
                const value = selfEvaluation[q.key] as string | null;
                if (!value) return null;
                return (
                  <div key={q.key} className="keep">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center justify-center rounded-full"
                        style={{ width: "18pt", height: "18pt", background: q.hue, color: SHEET, fontSize: "9pt", fontWeight: 700 }}
                      >
                        {i + 1}
                      </span>
                      <p className="font-serif" style={{ fontSize: "12pt", fontWeight: 600, color: q.hue }}>
                        {q.label}
                      </p>
                    </div>
                    <p className="mt-1" style={{ borderLeft: `2px solid ${q.hue}`, paddingLeft: "10pt", fontSize: "10pt", whiteSpace: "pre-line" }}>
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>

            {(selfEvaluation.action_points ?? []).some((p) => p.previous_point || p.what_i_did) ? (
              <div className="keep mt-4">
                <Marker colour={GOLD_INK} label="Action points from the last TP" />
                <div className="mt-1.5">
                  {(selfEvaluation.action_points ?? []).map((point, i) =>
                    point.previous_point || point.what_i_did ? (
                      <div key={i} className="keep grid grid-cols-2 gap-4" style={{ padding: "5pt 0", borderBottom: `1px solid ${FAINT}` }}>
                        <div style={{ borderRadius: "5pt", borderLeft: `3px solid ${GOLD}`, background: GOLD_WASH, padding: "5pt 8pt", fontSize: "9.5pt" }}>
                          <span style={{ color: GOLD_INK }}>★ </span>
                          {point.previous_point}
                        </div>
                        <p style={{ fontSize: "9.5pt", whiteSpace: "pre-line" }}>{point.what_i_did}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ) : null}

            {feedback?.self_eval_comment ? (
              <div className="keep mt-4" style={{ borderTop: `1.5px solid ${GARNET}`, paddingTop: "10pt" }}>
                <Marker colour={GARNET} label="Tutor's comment on this self-evaluation" />
                <p className="mt-1" style={{ borderLeft: `2px solid ${GARNET}`, paddingLeft: "10pt", fontSize: "10pt", whiteSpace: "pre-line" }}>
                  {feedback.self_eval_comment}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        <div
          className="mt-6 flex flex-wrap justify-between gap-3"
          style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "6pt", fontSize: "9pt", letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}
        >
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ pieces

function Band({
  fill,
  eyebrow,
  eyebrowColour,
  title,
  subLine,
  subColour,
  titleSize = "22pt",
  children,
}: {
  fill: string;
  eyebrow: string;
  eyebrowColour: string;
  title: React.ReactNode;
  subLine?: string;
  subColour?: string;
  titleSize?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ margin: "0 -0.7in", background: fill, padding: "22pt 0.7in 18pt", color: SHEET }}>
      <p style={{ fontSize: "8.5pt", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: eyebrowColour }}>
        {eyebrow}
      </p>
      <h2 className="font-serif" style={{ margin: "4pt 0 0", fontSize: titleSize, fontWeight: 400, lineHeight: 1.15 }}>
        {title}
      </h2>
      {subLine ? <p style={{ marginTop: "4pt", fontSize: "10pt", color: subColour }}>{subLine}</p> : null}
      {children}
    </div>
  );
}

function Marker({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span style={{ width: "2.5pt", height: "9pt", borderRadius: "1pt", background: colour, display: "inline-block" }} />
      <span style={{ fontSize: "8.5pt", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: colour }}>
        {label}
      </span>
    </span>
  );
}

function AimBlock({ label, colour, value }: { label: string; colour: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="keep">
      <Marker colour={colour} label={label} />
      <p className="mt-1" style={{ fontSize: "10pt", whiteSpace: "pre-line" }}>
        {value}
      </p>
    </div>
  );
}

function PointColumn({
  glyph,
  title,
  hue,
  strengths,
  actions,
}: {
  glyph: string;
  title: string;
  hue: string;
  strengths: FeedbackPoint[];
  actions: FeedbackPoint[];
}) {
  const written = (points: FeedbackPoint[]) => points.filter((p) => p.text.trim());
  return (
    <div className="keep flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center rounded-full"
          style={{ width: "20pt", height: "20pt", background: hue, color: SHEET, fontSize: "9pt", fontWeight: 700 }}
        >
          {glyph}
        </span>
        <h3 className="font-serif" style={{ fontSize: "16pt", fontWeight: 600, color: hue }}>
          {title}
        </h3>
      </div>
      <PointList label="Strengths" colour={TEAL} points={written(strengths)} />
      <PointList label="Action points" colour={GOLD_INK} points={written(actions)} starrable />
    </div>
  );
}

function PointList({
  label,
  colour,
  points,
  starrable = false,
}: {
  label: string;
  colour: string;
  points: FeedbackPoint[];
  starrable?: boolean;
}) {
  if (points.length === 0) return null;
  return (
    <div className="keep">
      <Marker colour={colour} label={label} />
      <ul className="mt-1.5 flex flex-col gap-1.5" style={{ fontSize: "10pt" }}>
        {points.map((p, i) => (
          <li key={i}>
            {starrable && p.starred ? <span style={{ color: GOLD_INK }}>★ </span> : null}
            <span style={{ whiteSpace: "pre-line" }}>{p.text}</span>
            {p.criteria_codes.length > 0 ? (
              <span style={{ fontSize: "8pt", fontWeight: 700, color: colour }}> {p.criteria_codes.join(" · ")}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The anchored points, printed a second time beside the part they refer to. */
function AnchoredComments({
  title,
  points,
  stageNames,
  vocabItems,
}: {
  title: string;
  points: FeedbackPoint[];
  stageNames: string[];
  vocabItems: string[];
}) {
  return (
    <div className="keep mt-4" style={{ borderTop: `1.5px solid ${TEAL}`, paddingTop: "10pt" }}>
      <Marker colour={TEAL} label={title} />
      <ul className="mt-1.5 flex flex-col gap-1.5" style={{ fontSize: "10pt" }}>
        {points.map((p, i) => (
          <li key={i}>
            <span style={{ fontSize: "8pt", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>
              {labelForAnchor(p.anchor, stageNames, vocabItems)} ·{" "}
            </span>
            <span style={{ whiteSpace: "pre-line" }}>{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function labelForAnchor(anchor: string | undefined, stageNames: string[], vocabItems: string[]): string {
  if (!anchor) return "On the plan";
  if (anchor === "aims") return "Aims";
  if (anchor === "problems") return "Problems & solutions";
  if (anchor === "room") return "Class profile & materials";
  if (anchor === "la") return "Language analysis";
  if (anchor.startsWith("stage-")) {
    const n = Number(anchor.slice(6));
    return stageNames[n - 1] ? `Stage ${n} · ${stageNames[n - 1]}` : `Stage ${n}`;
  }
  if (anchor.startsWith("vocab-")) {
    const n = Number(anchor.slice(6));
    return vocabItems[n - 1] ? `Item · ${vocabItems[n - 1]}` : `Item ${n}`;
  }
  if (anchor.startsWith("block-")) return `Structure ${anchor.slice(6)}`;
  return anchor;
}
