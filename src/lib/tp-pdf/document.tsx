import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/types";
import type { FeedbackPoint, ProblemSolutionPair } from "@/lib/tp-plan-content";

type TpPlan = Database["public"]["Tables"]["tp_plans"]["Row"];
type TpLanguageAnalysis = Database["public"]["Tables"]["tp_language_analyses"]["Row"];
type TpSelfEvaluation = Database["public"]["Tables"]["tp_self_evaluations"]["Row"];
type TpFeedback = Database["public"]["Tables"]["tp_feedback"]["Row"];

// The TP record as a real PDF -- the file the close-out export archives for
// the centre (Handbook 12.1.1) and the "PDF with materials" download, which
// merges the candidate's own uploaded handouts in with pdf-lib.
//
// One design, two renderers (Ramy, 17 Sep 2026: "go with 2"). This is the
// assembled document at /tp-document/[traineeId]/[tpNumber] drawn again in
// @react-pdf: the same four bands in the same role colours, in the same
// order -- tutor feedback (teal) -> lesson plan (ink-warm) -> language
// analysis (gold-ink) -> self-evaluation (garnet) -- the same markers, the
// same six self-evaluation questions in the same words. A band is chosen by
// ROLE and carries its palette with it (src/lib/sheet-tokens.ts); the hex
// values here are those oklch tokens through Oklab, because a PDF cannot
// read oklch. If a token is retinted, convert again rather than eyeballing.
//
// Why not one renderer: a browser-printed page cannot append someone's PDF
// attachment or feed the export, and headless Chromium on Vercel is a heavy
// dependency for a document this size.

const SHEET = "#fefcf9";
const INK = "#241d16";
const INK_WARM = "#3e2818";
const MUTED = "#6d655c";
const TEAL = "#0f4a4b";
const GOLD_INK = "#744703";
const GOLD_WASH = "#ffeabc";
const GARNET = "#862723";
const BORDER = "#ddd7cc";
const ZEBRA = "#faf7f0";

const BANDS = {
  feedback: { fill: TEAL, eyebrow: "#a5d5d5" },
  plan: { fill: INK_WARM, eyebrow: "#d0b690" },
  la: { fill: GOLD_INK, eyebrow: "#f3dab2" },
  selfEval: { fill: GARNET, eyebrow: "#f5c5b4" },
};
const STAGE_HUES = [TEAL, GOLD_INK, INK_WARM, INK_WARM, GARNET, MUTED, TEAL];

const SELF_EVAL_QUESTIONS = [
  { key: "what_went_well", label: "What went to plan?", hue: TEAL },
  { key: "what_not_as_planned", label: "What didn't go as planned, and why?", hue: GARNET },
  { key: "evidence_of_learning", label: "What evidence did you see that the learners had learnt?", hue: INK_WARM },
  { key: "what_differently", label: "What would you do differently if you taught it again?", hue: GOLD_INK },
  { key: "next_tp_focus", label: "What do you want to work on in the next TP?", hue: TEAL },
] as const;

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 40, paddingHorizontal: 0, fontSize: 10, fontFamily: "Helvetica", color: INK, backgroundColor: SHEET },
  band: { paddingTop: 22, paddingBottom: 20, paddingHorizontal: 34 },
  eyebrow: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  bandTitle: { fontFamily: "Times-Roman", fontSize: 24, color: SHEET, lineHeight: 1.15 },
  bandSub: { fontSize: 9.5, marginTop: 6 },
  body: { paddingTop: 18, paddingHorizontal: 34, flexDirection: "column", gap: 12 },
  marker: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  markerBar: { width: 2.5, height: 9, borderRadius: 1 },
  markerText: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  value: { fontSize: 10, lineHeight: 1.45 },
  serif: { fontFamily: "Times-Roman", fontSize: 12, lineHeight: 1.5 },
  columns: { flexDirection: "row", gap: 22 },
  column: { flex: 1, flexDirection: "column", gap: 8 },
  glyph: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  glyphText: { color: SHEET, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  columnTitle: { fontFamily: "Times-Roman", fontSize: 15 },
  point: { fontSize: 10, lineHeight: 1.4, marginBottom: 3 },
  code: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK_WARM, paddingBottom: 3, marginBottom: 2 },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, textTransform: "uppercase", color: MUTED },
  td: { fontSize: 9, lineHeight: 1.35, paddingRight: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: SHEET, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11 },
  note: { fontSize: 8.5, color: MUTED },
  wash: { backgroundColor: GOLD_WASH, padding: 8, borderRadius: 4 },
});

function Band({ role, eyebrow, title, sub, children }: { role: keyof typeof BANDS; eyebrow: string; title: string; sub?: string | null; children?: React.ReactNode }) {
  const b = BANDS[role];
  return (
    <View style={[s.band, { backgroundColor: b.fill }]}>
      <Text style={[s.eyebrow, { color: b.eyebrow }]}>{eyebrow}</Text>
      <Text style={s.bandTitle}>{title}</Text>
      {sub ? <Text style={[s.bandSub, { color: b.eyebrow }]}>{sub}</Text> : null}
      {children}
    </View>
  );
}

function Marker({ colour, label }: { colour: string; label: string }) {
  return (
    <View style={s.marker}>
      <View style={[s.markerBar, { backgroundColor: colour }]} />
      <Text style={[s.markerText, { color: colour }]}>{label}</Text>
    </View>
  );
}

function Field({ label, colour, value }: { label: string; colour: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View wrap={false}>
      <Marker colour={colour} label={label} />
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

function PointList({ label, colour, points, starrable = false }: { label: string; colour: string; points: FeedbackPoint[]; starrable?: boolean }) {
  const written = points.filter((p) => p.text.trim());
  if (written.length === 0) return null;
  return (
    <View>
      <Marker colour={colour} label={label} />
      {written.map((p, i) => (
        <Text key={i} style={s.point}>
          {starrable && p.starred ? <Text style={{ color: GOLD_INK }}>{"★ "}</Text> : null}
          {p.text}
          {p.criteria_codes.length > 0 ? <Text style={[s.code, { color: colour }]}>{`  ${p.criteria_codes.join(" · ")}`}</Text> : null}
        </Text>
      ))}
    </View>
  );
}

function PointColumn({ glyph, title, hue, strengths, actions }: { glyph: string; title: string; hue: string; strengths: FeedbackPoint[]; actions: FeedbackPoint[] }) {
  return (
    <View style={s.column}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={[s.glyph, { backgroundColor: hue }]}>
          <Text style={s.glyphText}>{glyph}</Text>
        </View>
        <Text style={[s.columnTitle, { color: hue }]}>{title}</Text>
      </View>
      <PointList label="Strengths" colour={TEAL} points={strengths} />
      <PointList label="Action points" colour={GOLD_INK} points={actions} starrable />
    </View>
  );
}

function ProblemList({ pairs }: { pairs: ProblemSolutionPair[] }) {
  const filled = pairs.filter((p) => p.problem || p.solution);
  if (filled.length === 0) return null;
  return (
    <View wrap={false}>
      <Marker colour={GARNET} label="Anticipated problems & solutions" />
      {filled.map((p, i) => (
        <Text key={i} style={s.point}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Problem </Text>
          {p.problem}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{"   Solution "}</Text>
          {p.solution}
        </Text>
      ))}
    </View>
  );
}

export async function renderTpPdfBuffer(input: {
  traineeName: string;
  tpNumber: number;
  plan: TpPlan;
  languageAnalysis: TpLanguageAnalysis | null;
  selfEvaluation: TpSelfEvaluation | null;
  feedback: TpFeedback;
  /** Optional, for the cover's sub-line; the export does not always have them. */
  tutorName?: string | null;
  submittedOn?: string | null;
  lessonTitle?: string | null;
}): Promise<Buffer> {
  const { traineeName, tpNumber, plan, languageAnalysis, selfEvaluation, feedback, tutorName, submittedOn, lessonTitle } = input;

  const laHasContent =
    languageAnalysis &&
    (languageAnalysis.context ||
      languageAnalysis.blocks.some((b) => Object.values(b).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)))) ||
      languageAnalysis.vocab_rows.some((r) => Object.values(r).some((v) => v)));

  const gradeLabel = feedback.grade ? feedback.grade.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : null;
  const eyebrowFor = (extra?: string | null) => [`Teaching Practice ${tpNumber}`, extra].filter(Boolean).join(" · ");
  const carried = (selfEvaluation as { carried_action_points?: FeedbackPoint[] } | null)?.carried_action_points ?? [];

  return renderToBuffer(
    <Document title={`TP${tpNumber} — ${traineeName}`} author="Connect">
      {/* ============ 1. Tutor feedback ============ */}
      <Page size="A4" style={s.page}>
        <Band role="feedback" eyebrow={eyebrowFor(submittedOn)} title={`Tutor feedback for ${traineeName}`}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
            {gradeLabel ? (
              <View style={s.pill}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
                <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: TEAL }}>{gradeLabel}</Text>
              </View>
            ) : null}
            {tutorName || lessonTitle ? (
              <Text style={{ fontSize: 9.5, color: BANDS.feedback.eyebrow }}>
                {[tutorName ? `Tutor: ${tutorName}` : null, lessonTitle].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
        </Band>
        <View style={s.body}>
          <View style={s.columns}>
            <PointColumn glyph="P" title="Planning" hue={INK_WARM} strengths={feedback.strengths_planning} actions={feedback.action_points_planning} />
            <PointColumn glyph="T" title="Teaching" hue={GARNET} strengths={feedback.strengths_teaching} actions={feedback.action_points_teaching} />
          </View>
          {feedback.overall_comment ? (
            <View wrap={false}>
              <Marker colour={INK_WARM} label="Overall comment" />
              <View style={{ borderLeftWidth: 2, borderLeftColor: INK_WARM, paddingLeft: 12 }}>
                <Text style={s.serif}>{feedback.overall_comment}</Text>
              </View>
            </View>
          ) : null}
          <Text style={s.note}>{`★ Starred action points carry into the Personal Aims of your TP${tpNumber + 1} plan.`}</Text>
        </View>
      </Page>

      {/* ============ 2. Lesson plan ============ */}
      <Page size="A4" style={s.page}>
        <Band role="plan" eyebrow={eyebrowFor()} title="Lesson plan" sub={lessonTitle ?? undefined} />
        <View style={s.body}>
          <Field label="Main aims" colour={TEAL} value={plan.main_aims} />
          <Field label="Subsidiary aims" colour={GOLD_INK} value={plan.subsidiary_aims} />
          <Field label="Personal aims" colour={GARNET} value={plan.personal_aims} />
          <Field label="Class profile" colour={INK_WARM} value={plan.class_profile} />
          <ProblemList pairs={plan.anticipated_problems} />
          <Field label="Materials" colour={TEAL} value={plan.materials_description} />
          {plan.procedure.length > 0 ? (
            <View>
              <Marker colour={INK_WARM} label="Procedure" />
              <View style={s.tableHead}>
                <Text style={[s.th, { flex: 1.3 }]}>Stage · aim</Text>
                <Text style={[s.th, { flex: 0.7 }]}>Interaction</Text>
                <Text style={[s.th, { flex: 0.5 }]}>Time</Text>
                <Text style={[s.th, { flex: 3.2 }]}>Procedure</Text>
              </View>
              {plan.procedure.map((row, i) => (
                <View key={i} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
                  <View style={{ flex: 1.3, flexDirection: "row", gap: 5, paddingRight: 6 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, marginTop: 3, backgroundColor: STAGE_HUES[i % STAGE_HUES.length] }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.td, { fontFamily: "Helvetica-Bold", paddingRight: 0 }]}>{row.stage}</Text>
                      {row.aim ? <Text style={[s.td, { color: MUTED, paddingRight: 0 }]}>{row.aim}</Text> : null}
                    </View>
                  </View>
                  <Text style={[s.td, { flex: 0.7 }]}>{row.interaction}</Text>
                  <Text style={[s.td, { flex: 0.5 }]}>{row.time}</Text>
                  <Text style={[s.td, { flex: 3.2 }]}>{row.procedure}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Page>

      {/* ============ 3. Language analysis ============ */}
      {laHasContent && languageAnalysis ? (
        <Page size="A4" style={s.page}>
          <Band role="la" eyebrow={eyebrowFor()} title="Language analysis" sub={languageAnalysis.type === "vocab" ? "Vocabulary" : "Grammar"} />
          <View style={s.body}>
            <Field label="Overall context" colour={GOLD_INK} value={languageAnalysis.context} />
            {languageAnalysis.type === "vocab"
              ? languageAnalysis.vocab_rows.map((row, i) => (
                  <View key={i} wrap={false} style={{ borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8, gap: 6 }}>
                    <Text style={[s.columnTitle, { color: GOLD_INK }]}>{row.item || `Item ${i + 1}`}</Text>
                    <Field label="Definition" colour={GOLD_INK} value={row.definition} />
                    <Field label="Convey" colour={TEAL} value={row.convey} />
                    <Field label="Clarification" colour={TEAL} value={row.clarification} />
                    <Field label="Form" colour={INK_WARM} value={row.form} />
                    <Field label="Problems & solutions" colour={GARNET} value={row.problems} />
                  </View>
                ))
              : languageAnalysis.blocks.map((block, i) => (
                  <View key={i} wrap={false} style={{ borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8, gap: 6 }}>
                    <Text style={[s.columnTitle, { color: GOLD_INK }]}>{block.item || `Structure ${i + 1}`}</Text>
                    <Field label="Marker" colour={GOLD_INK} value={block.marker} />
                    <Field label="Meaning" colour={TEAL} value={block.meaning} />
                    <Field label="Form" colour={INK_WARM} value={block.form} />
                    <Field label="Phonetic transcription" colour={GARNET} value={block.phonetic} />
                    <Field label="Pronunciation features" colour={GARNET} value={block.pronunciation_features} />
                  </View>
                ))}
          </View>
        </Page>
      ) : null}

      {/* ============ 4. Self-evaluation ============ */}
      <Page size="A4" style={s.page}>
        <Band role="selfEval" eyebrow={eyebrowFor()} title="Self-evaluation" />
        <View style={s.body}>
          {SELF_EVAL_QUESTIONS.map((q, i) => {
            const answer = (selfEvaluation as Record<string, unknown> | null)?.[q.key];
            return (
              <View key={q.key} wrap={false}>
                <View style={s.marker}>
                  <View style={[s.glyph, { width: 14, height: 14, borderRadius: 7, backgroundColor: q.hue }]}>
                    <Text style={[s.glyphText, { fontSize: 7 }]}>{i + 1}</Text>
                  </View>
                  <Text style={[s.markerText, { color: q.hue, textTransform: "none", letterSpacing: 0, fontSize: 9.5 }]}>{q.label}</Text>
                </View>
                <Text style={[s.value, { borderLeftWidth: 1.5, borderLeftColor: q.hue, paddingLeft: 10 }]}>
                  {typeof answer === "string" && answer.trim() ? answer : "—"}
                </Text>
              </View>
            );
          })}
          {carried.length > 0 ? (
            <View style={s.wash} wrap={false}>
              <Marker colour={GOLD_INK} label="Action points from the last TP" />
              {carried.map((p, i) => (
                <Text key={i} style={s.point}>{`★ ${p.text}`}</Text>
              ))}
            </View>
          ) : null}
          {feedback.self_eval_comment ? (
            <View wrap={false}>
              <Marker colour={TEAL} label="Tutor's comment on this self-evaluation" />
              <View style={{ borderLeftWidth: 2, borderLeftColor: TEAL, paddingLeft: 12 }}>
                <Text style={s.serif}>{feedback.self_eval_comment}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
