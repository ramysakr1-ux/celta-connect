import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/types";
import type { FeedbackPoint, ProblemSolutionPair } from "@/lib/tp-plan-content";

type TpPlan = Database["public"]["Tables"]["tp_plans"]["Row"];
type TpLanguageAnalysis = Database["public"]["Tables"]["tp_language_analyses"]["Row"];
type TpSelfEvaluation = Database["public"]["Tables"]["tp_self_evaluations"]["Row"];
type TpFeedback = Database["public"]["Tables"]["tp_feedback"]["Row"];

// Assembled document order, confirmed by the content architecture spec:
// feedback+grade (cover) -> lesson plan -> LA sheet (if not empty) ->
// self-evaluation (with the trainer's comment on it). Materials are merged
// in separately by the route handler (pdf-lib, for the actual uploaded
// PDF/image bytes) since @react-pdf/renderer can't embed arbitrary PDFs.

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#2a2723" },
  h1: { fontSize: 18, marginBottom: 12, color: "#1c4e52", textAlign: "center" },
  h2: { fontSize: 13, marginTop: 14, marginBottom: 6, color: "#1c4e52" },
  h3: { fontSize: 11, marginTop: 10, marginBottom: 4, color: "#1c4e52" },
  label: { fontSize: 8, color: "#7c7368", textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 10, marginBottom: 8, lineHeight: 1.4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2ded5", paddingVertical: 4 },
  cell: { flex: 1, paddingRight: 6 },
  headerRow: { flexDirection: "row", backgroundColor: "#f3ecdb", paddingVertical: 4 },
  point: { marginBottom: 4 },
});

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ProblemList({ pairs }: { pairs: ProblemSolutionPair[] }) {
  const filled = pairs.filter((p) => p.problem || p.solution);
  if (filled.length === 0) return null;
  return (
    <View>
      <Text style={styles.label}>Anticipated problems & solutions</Text>
      {filled.map((p, i) => (
        <Text key={i} style={styles.value}>
          Problem: {p.problem} — Solution: {p.solution}
        </Text>
      ))}
    </View>
  );
}

function PointSection({ label, points }: { label: string; points: FeedbackPoint[] }) {
  if (points.length === 0) return null;
  return (
    <View>
      <Text style={styles.h3}>{label}</Text>
      {points.map((p, i) => (
        <Text key={i} style={styles.point}>
          {p.starred ? "★ " : ""}
          {p.text}
          {p.criteria_codes.length > 0 ? `  (${p.criteria_codes.join(", ")})` : ""}
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
}): Promise<Buffer> {
  const { traineeName, tpNumber, plan, languageAnalysis, selfEvaluation, feedback } = input;

  const laHasContent =
    languageAnalysis &&
    (languageAnalysis.context ||
      languageAnalysis.blocks.some((b) => Object.values(b).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))))
      || languageAnalysis.vocab_rows.some((r) => Object.values(r).some((v) => v)));

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>TP{tpNumber} Feedback</Text>
        <Text style={styles.value}>
          {traineeName} — TP{tpNumber}
        </Text>
        {feedback.grade ? <Field label="Grade" value={feedback.grade.replace(/_/g, " ")} /> : null}
        <PointSection label="Strengths in planning" points={feedback.strengths_planning} />
        <PointSection label="Action points in planning" points={feedback.action_points_planning} />
        <PointSection label="Strengths in teaching" points={feedback.strengths_teaching} />
        <PointSection label="Action points in teaching" points={feedback.action_points_teaching} />
        <Field label="Overall comment" value={feedback.overall_comment} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Lesson Plan</Text>
        <Field label="Main Aims" value={plan.main_aims} />
        <Field label="Subsidiary Aims" value={plan.subsidiary_aims} />
        <Field label="Personal Aims" value={plan.personal_aims} />
        <ProblemList pairs={plan.anticipated_problems} />
        <Field label="Class Profile" value={plan.class_profile} />
        <Field label="Materials" value={plan.materials_description} />
        {plan.procedure.length > 0 ? (
          <View>
            <Text style={styles.h2}>Procedure</Text>
            <View style={styles.headerRow}>
              <Text style={[styles.cell, { flex: 1.2 }]}>Stage</Text>
              <Text style={[styles.cell, { flex: 3 }]}>Procedure</Text>
              <Text style={styles.cell}>Interaction</Text>
              <Text style={styles.cell}>Time</Text>
            </View>
            {plan.procedure.map((row, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.cell, { flex: 1.2 }]}>{row.stage}</Text>
                <Text style={[styles.cell, { flex: 3 }]}>{row.procedure}</Text>
                <Text style={styles.cell}>{row.interaction}</Text>
                <Text style={styles.cell}>{row.time}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Page>

      {laHasContent && languageAnalysis ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Language Analysis Sheet</Text>
          <Text style={styles.value}>Type: {languageAnalysis.type}</Text>
          <Field label="Overall context" value={languageAnalysis.context} />
          {languageAnalysis.type === "vocab"
            ? languageAnalysis.vocab_rows.map((row, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={styles.h3}>{row.item || `Item ${i + 1}`}</Text>
                  <Field label="Definition" value={row.definition} />
                  <Field label="Convey" value={row.convey} />
                  <Field label="Clarification" value={row.clarification} />
                  <Field label="Form" value={row.form} />
                  <Field label="Problems & solutions" value={row.problems} />
                </View>
              ))
            : languageAnalysis.blocks.map((block, i) => (
                <View key={i} style={{ marginBottom: 8 }}>
                  <Text style={styles.h3}>{block.item || `Structure ${i + 1}`}</Text>
                  <Field label="Marker" value={block.marker} />
                  <Field label="Meaning" value={block.meaning} />
                  <Field label="Form" value={block.form} />
                  <Field label="Phonetic transcription" value={block.phonetic} />
                  <Field label="Pronunciation features" value={block.pronunciation_features} />
                </View>
              ))}
        </Page>
      ) : null}

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Self-Evaluation</Text>
        <Field label="What went to plan?" value={selfEvaluation?.what_went_well} />
        <Field label="What didn't go as planned, and why?" value={selfEvaluation?.what_not_as_planned} />
        <Field label="Evidence of learning" value={selfEvaluation?.evidence_of_learning} />
        <Field label="What I'd do differently" value={selfEvaluation?.what_differently} />
        <Field label="Focus for next TP" value={selfEvaluation?.next_tp_focus} />
        <Field label="Tutor's comment on this self-evaluation" value={feedback.self_eval_comment} />
      </Page>
    </Document>
  );
}
