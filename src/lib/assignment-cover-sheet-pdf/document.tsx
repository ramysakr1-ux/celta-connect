import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { AssignmentCriterion } from "@/lib/assignment-criteria";

// Assignment Review.dc.html 1d (checkpoint 6) -- the cover sheet that goes
// in the portfolio, assembled entirely from data already captured while
// marking (Areas 2-3), never a second place anything gets typed. Same
// react-pdf pattern as certificate-pdf/final-report-pdf: local hex COLOR
// object (react-pdf can't read CSS custom properties), Font.register from
// public/fonts. Per specs/README.md's "whose brand appears where" rule --
// this document leaves the system, so it carries the centre's own
// logo/name only, falling back to centre name in text, never a Connect
// mark. Second page(s) carry the actual submitted work, clearly separated
// by round ("the distinction between rounds must be unmistakable," per the
// spec) -- plain text render, since submissions are already structured
// text, not a scan or file merge.
const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Newsreader", src: path.join(fontsDir, "Newsreader.ttf") });
Font.register({ family: "Karla", src: path.join(fontsDir, "Karla.ttf") });

const COLOR = {
  ink: "#2a2723",
  muted: "#7c7368",
  border: "#e2ded5",
  teal: "#1c4e52",
  gold: "#a97a2f",
  amber: "#8a5a12",
  cream: "#f8f3e8",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Karla", fontSize: 9.5, color: COLOR.ink },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.ink,
    paddingBottom: 12,
    marginBottom: 16,
  },
  eyebrow: { fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase", color: COLOR.muted },
  title: { fontFamily: "Newsreader", fontSize: 20, color: COLOR.ink, marginTop: 3 },
  logo: { width: 60, objectFit: "contain" },
  logoFallbackText: { fontFamily: "Newsreader", fontSize: 13, color: COLOR.ink },

  factsGrid: { marginBottom: 14 },
  factRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
  },
  factLabel: { fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: COLOR.muted, width: 78 },
  factValue: { fontSize: 9.5, color: COLOR.ink, flex: 1 },

  sectionLabel: { fontSize: 8, letterSpacing: 1.2, textTransform: "uppercase", color: COLOR.muted, marginBottom: 6 },

  table: { borderWidth: 0.75, borderColor: COLOR.border, marginBottom: 12 },
  tableRow: { padding: 6, borderBottomWidth: 0.5, borderBottomColor: COLOR.border },
  criterionText: { fontSize: 8.5, lineHeight: 1.4, marginBottom: 3 },
  criterionMarks: { fontSize: 8, color: COLOR.muted },
  criterionMarkMet: { color: COLOR.teal },
  criterionMarkNotMet: { color: COLOR.amber },

  outcomeGrid: { marginBottom: 12 },
  outcomeRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  outcomeBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 0.75, borderColor: COLOR.border, padding: 6 },
  outcomeBoxOn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 0.75, borderColor: COLOR.teal, backgroundColor: COLOR.cream, padding: 6 },
  outcomeCheck: { width: 9, height: 9, borderWidth: 0.75, borderColor: COLOR.muted },
  outcomeCheckOn: { width: 9, height: 9, backgroundColor: COLOR.teal, borderWidth: 0.75, borderColor: COLOR.teal },
  outcomeLabel: { fontSize: 8.5 },

  signRow: { flexDirection: "row", borderWidth: 0.75, borderColor: COLOR.border, marginBottom: 14 },
  signCell: { flex: 1, padding: 7, borderRightWidth: 0.5, borderRightColor: COLOR.border },
  signLabel: { fontSize: 7, letterSpacing: 1, textTransform: "uppercase", color: COLOR.muted },
  signValue: { fontSize: 9, color: COLOR.ink, marginTop: 2 },

  commentTable: { borderWidth: 0.75, borderColor: COLOR.border, marginBottom: 12 },
  commentRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.border },
  commentLabel: { width: 110, padding: 6, fontSize: 8, fontWeight: 700, backgroundColor: COLOR.cream },
  commentValue: { flex: 1, padding: 6, fontSize: 8.5, lineHeight: 1.4, borderLeftWidth: 0.5, borderLeftColor: COLOR.border },

  declarationItem: { flexDirection: "row", gap: 6, marginBottom: 4 },
  declarationCheck: { width: 7, height: 7, backgroundColor: COLOR.ink, marginTop: 1 },
  declarationText: { flex: 1, fontSize: 8, lineHeight: 1.4 },

  signatureRow: { flexDirection: "row", gap: 30, marginTop: 12 },
  signatureBlock: { flex: 1 },
  signatureLine: { borderBottomWidth: 0.75, borderBottomColor: COLOR.ink, paddingBottom: 4, fontSize: 9 },
  signatureCaption: { fontSize: 7, letterSpacing: 1, textTransform: "uppercase", color: COLOR.muted, marginTop: 3 },

  workPage: { padding: 40, fontFamily: "Karla", fontSize: 9.5, color: COLOR.ink },
  workHeader: { fontFamily: "Newsreader", fontSize: 15, color: COLOR.ink, marginBottom: 2 },
  workRoundLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: COLOR.teal,
    marginTop: 18,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLOR.teal,
    paddingTop: 6,
  },
  workSectionTitle: { fontFamily: "Newsreader", fontSize: 11, color: COLOR.ink, marginTop: 10, marginBottom: 3 },
  workSectionBody: { fontSize: 9, lineHeight: 1.5, color: COLOR.ink },
});

interface CriterionMarkRow {
  criterion: AssignmentCriterion;
  first: boolean | undefined;
  second: boolean | undefined;
}

export interface AssignmentCoverSheetInput {
  candidateName: string;
  centerName: string;
  centerLogoUrl: string | null;
  courseName: string;
  courseDates: string;
  assignmentTitle: string;
  firstSubmittedAt: string | null;
  resubmittedAt: string | null;
  firstMarkerName: string;
  secondMarkerName: string | null;
  secondMarkerDate: string | null;
  criteria: CriterionMarkRow[];
  outcome: "pass" | "resubmission_required" | "pass_on_resubmission" | "fail_on_resubmission";
  sectionComments: { title: string; firstComment: string | null; resubmissionComment: string | null }[];
  hasResubmission: boolean;
  sections: { title: string; firstResponse: string | null; resubmissionResponse: string | null }[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function markText(met: boolean | undefined): string {
  if (met === undefined) return "—";
  return met ? "Met" : "Not met";
}

function markColor(met: boolean | undefined): string {
  if (met === undefined) return COLOR.muted;
  return met ? COLOR.teal : COLOR.amber;
}

const OUTCOME_OPTIONS: { key: AssignmentCoverSheetInput["outcome"]; label: string }[] = [
  { key: "pass", label: "Pass" },
  { key: "resubmission_required", label: "Resubmission Needed" },
  { key: "pass_on_resubmission", label: "Pass on Resubmission" },
  { key: "fail_on_resubmission", label: "Fail on Resubmission" },
];

const DECLARATION = [
  "I confirm that I have read the instructions above.",
  "I confirm that this assignment is my own work.",
  "I confirm that I have referenced all resources used, including AI tools, in accordance with the guidelines above.",
  "I hereby attach the link to the assignment-related AI conversation used for generating ideas and/or proofreading.",
  "I understand that any unacknowledged use of resources, including AI, will result in a failing grade for the assignment on first submission.",
  "I confirm that my work is between 750-1,000 words.",
];

export async function renderAssignmentCoverSheetBuffer(input: AssignmentCoverSheetInput): Promise<Buffer> {
  const {
    candidateName,
    centerName,
    centerLogoUrl,
    courseName,
    courseDates,
    assignmentTitle,
    firstSubmittedAt,
    resubmittedAt,
    firstMarkerName,
    secondMarkerName,
    secondMarkerDate,
    criteria,
    outcome,
    sectionComments,
    hasResubmission,
    sections,
  } = input;

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Cambridge CELTA · written assignment</Text>
            <Text style={styles.title}>{assignmentTitle}</Text>
          </View>
          {centerLogoUrl ? <Image src={centerLogoUrl} style={styles.logo} /> : <Text style={styles.logoFallbackText}>{centerName}</Text>}
        </View>

        <View style={styles.factsGrid}>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Candidate</Text>
            <Text style={styles.factValue}>{candidateName}</Text>
          </View>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Centre</Text>
            <Text style={styles.factValue}>{centerName}</Text>
          </View>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Course</Text>
            <Text style={styles.factValue}>{courseName} · {courseDates}</Text>
          </View>
          <View style={styles.factRow}>
            <Text style={styles.factLabel}>Submitted</Text>
            <Text style={styles.factValue}>
              {formatDate(firstSubmittedAt)}
              {hasResubmission ? ` (1st) · ${formatDate(resubmittedAt)} (resubmission)` : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Assessment criteria</Text>
        <View style={styles.table}>
          {criteria.map((row) => (
            <View key={row.criterion.key} style={styles.tableRow}>
              <Text style={styles.criterionText}>{row.criterion.text}</Text>
              <Text style={styles.criterionMarks}>
                1st sub: <Text style={row.first === undefined ? undefined : row.first ? styles.criterionMarkMet : styles.criterionMarkNotMet}>{markText(row.first)}</Text>
                {hasResubmission ? (
                  <>
                    {"   ·   2nd sub: "}
                    <Text style={row.second === undefined ? undefined : row.second ? styles.criterionMarkMet : styles.criterionMarkNotMet}>{markText(row.second)}</Text>
                  </>
                ) : null}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.signRow}>
          <View style={styles.signCell}>
            <Text style={styles.signLabel}>Date</Text>
            <Text style={styles.signValue}>
              {formatDate(firstSubmittedAt)}
              {hasResubmission ? ` · ${formatDate(secondMarkerDate)}` : ""}
            </Text>
          </View>
          <View style={styles.signCell}>
            <Text style={styles.signLabel}>1st marker</Text>
            <Text style={styles.signValue}>{firstMarkerName}</Text>
          </View>
          <View style={[styles.signCell, { borderRightWidth: 0 }]}>
            <Text style={styles.signLabel}>2nd marker</Text>
            <Text style={styles.signValue}>{secondMarkerName ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Outcome</Text>
        <View style={styles.outcomeGrid}>
          {[OUTCOME_OPTIONS.slice(0, 2), OUTCOME_OPTIONS.slice(2, 4)].map((pair, i) => (
            <View key={i} style={styles.outcomeRow}>
              {pair.map((o) => {
                const on = o.key === outcome;
                return (
                  <View key={o.key} style={on ? styles.outcomeBoxOn : styles.outcomeBox}>
                    <View style={on ? styles.outcomeCheckOn : styles.outcomeCheck} />
                    <Text style={styles.outcomeLabel}>{o.label}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Comments</Text>
        <View style={styles.commentTable}>
          {sectionComments.map((c) => (
            <View key={c.title} style={styles.commentRow}>
              <Text style={styles.commentLabel}>{c.title}</Text>
              <Text style={styles.commentValue}>{c.firstComment || "—"}</Text>
            </View>
          ))}
        </View>
        {hasResubmission ? (
          <View style={styles.commentTable}>
            {sectionComments.map((c) => (
              <View key={`${c.title}-resub`} style={styles.commentRow}>
                <Text style={styles.commentLabel}>{c.title} · 2nd sub</Text>
                <Text style={styles.commentValue}>{c.resubmissionComment || "—"}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Declaration</Text>
        {DECLARATION.map((d) => (
          <View key={d} style={styles.declarationItem}>
            <View style={styles.declarationCheck} />
            <Text style={styles.declarationText}>{d}</Text>
          </View>
        ))}

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Accepted online · {formatDate(firstSubmittedAt)}</Text>
            <Text style={styles.signatureCaption}>Candidate</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>{firstMarkerName} · {formatDate(hasResubmission ? secondMarkerDate : firstSubmittedAt)}</Text>
            <Text style={styles.signatureCaption}>Tutor</Text>
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.workPage}>
        <Text style={styles.workHeader}>{assignmentTitle} -- submitted work</Text>
        <Text style={styles.workRoundLabel}>1st submission</Text>
        {sections.map((s) => (
          <View key={s.title}>
            <Text style={styles.workSectionTitle}>{s.title}</Text>
            <Text style={styles.workSectionBody}>{s.firstResponse || "(no response)"}</Text>
          </View>
        ))}
        {hasResubmission ? (
          <>
            <Text style={styles.workRoundLabel}>Resubmission</Text>
            {sections.map((s) => (
              <View key={`${s.title}-resub`}>
                <Text style={styles.workSectionTitle}>{s.title}</Text>
                <Text style={styles.workSectionBody}>{s.resubmissionResponse || "(no response)"}</Text>
              </View>
            ))}
          </>
        ) : null}
      </Page>
    </Document>
  );
}
