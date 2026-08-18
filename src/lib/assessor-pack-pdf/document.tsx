import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// "Download whole pack" (Assessor Visit.dc.html), and the centre's own copy:
// Ramy, 2026-08-16 -- "everything is handed into the centre as a PDF at the end
// of the course."
//
// A point-in-time document on purpose. for-claude-code-assessor-interface.md
// has the export "write the pack to the centre's own Drive... nothing retained
// by Cambridge", and full-email-specs.md says of the emailed pack that later
// changes never alter a pack already sent. So this renders what is true at the
// moment it is asked for, and says so on the page -- a PDF that quietly
// disagreed with the live screen would be worse than no PDF.
//
// Standard fonts only. The brand faces are webfonts; registering them here
// means a font fetch inside a request, and a pack that fails to render because
// a CDN was slow is not a trade worth making for a document nobody frames.

const INK = "#241d16";
const MUTED = "#6d655c";
const BORDER = "#e0dcd4";
const GOLD = "#ad7f43";
const GREEN = "#346c42";
const AMBER = "#6b4f1f";

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", color: INK },
  eyebrow: { fontSize: 8, letterSpacing: 1.2, color: MUTED, textTransform: "uppercase" },
  title: { fontSize: 20, fontFamily: "Times-Roman", marginTop: 6 },
  generated: { fontSize: 8, color: MUTED, marginTop: 4 },
  sectionLabel: { fontSize: 8, letterSpacing: 1, color: MUTED, textTransform: "uppercase", marginTop: 22, marginBottom: 7 },
  figuresRow: { flexDirection: "row", marginTop: 16, marginBottom: 4 },
  figure: { width: "25%" },
  figureLabel: { fontSize: 7, letterSpacing: 0.8, color: MUTED, textTransform: "uppercase" },
  figureValue: { fontSize: 13, fontFamily: "Times-Roman", marginTop: 3 },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  cellName: { width: "34%", fontSize: 9 },
  cellMeta: { width: "44%", fontSize: 8, color: MUTED },
  cellState: { width: "22%", fontSize: 8, textAlign: "right" },
  note: { fontSize: 8, color: MUTED, lineHeight: 1.5, marginTop: 10 },
  footer: { position: "absolute", bottom: 28, left: 44, right: 44, fontSize: 7.5, color: MUTED, textAlign: "center" },
});

export interface AssessorPackCandidate {
  name: string;
  tpsTaught: number;
  hoursAssessed: number;
  levels: string[];
  provisionalLabel: string | null;
  celta5Complete: boolean;
  tpsComplete: boolean;
  assignmentsComplete: boolean;
  flaggedIssue: string | null;
}

export interface AssessorPackInput {
  centreName: string;
  centreNumber: string;
  courseName: string;
  courseDates: string;
  visitDate: string | null;
  sendByDate: string | null;
  portfoliosComplete: number;
  totalCandidates: number;
  hoursAssessed: number;
  hoursRequired: number;
  gradesEntered: number;
  candidates: AssessorPackCandidate[];
  centreDocuments: { name: string; meta: string; present: boolean }[];
  cohortDocuments: string[];
  generatedAt: string;
}

export async function renderAssessorPackBuffer(input: AssessorPackInput): Promise<Buffer> {
  return renderToBuffer(
    <Document title={`Assessor pack — ${input.courseName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>
          {input.centreName} · {input.centreNumber} · {input.courseName} · {input.courseDates}
        </Text>
        <Text style={styles.title}>Assessor visit{input.visitDate ? ` — ${input.visitDate}` : ""}</Text>
        <Text style={styles.generated}>
          Prepared {input.generatedAt}. This is a point-in-time record — later changes do not alter it.
        </Text>

        <View style={styles.figuresRow}>
          <View style={styles.figure}>
            <Text style={styles.figureLabel}>Provisional grades due</Text>
            <Text style={[styles.figureValue, { color: GOLD }]}>{input.sendByDate ?? "Not set"}</Text>
          </View>
          <View style={styles.figure}>
            <Text style={styles.figureLabel}>Portfolios complete</Text>
            <Text
              style={[
                styles.figureValue,
                { color: input.portfoliosComplete >= input.totalCandidates ? GREEN : AMBER },
              ]}
            >
              {input.portfoliosComplete} of {input.totalCandidates}
            </Text>
          </View>
          <View style={styles.figure}>
            <Text style={styles.figureLabel}>Hours logged</Text>
            <Text style={[styles.figureValue, { color: input.hoursAssessed >= input.hoursRequired ? GREEN : AMBER }]}>
              {input.hoursAssessed.toFixed(1)} of {input.hoursRequired}
            </Text>
          </View>
          <View style={styles.figure}>
            <Text style={styles.figureLabel}>Provisional grades</Text>
            <Text style={[styles.figureValue, { color: input.gradesEntered >= input.totalCandidates ? GREEN : AMBER }]}>
              {input.gradesEntered} of {input.totalCandidates} MCT-approved
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Candidate portfolios</Text>
        {input.candidates.map((c) => (
          <View key={c.name} style={styles.row} wrap={false}>
            <Text style={styles.cellName}>
              {c.name}
              {c.provisionalLabel ? `  ·  ${c.provisionalLabel}` : ""}
            </Text>
            <Text style={styles.cellMeta}>
              {c.tpsTaught}/8 TPs · {c.hoursAssessed.toFixed(1)} hrs
              {c.levels.length > 0 ? ` · ${c.levels.join(", ")}` : ""}
              {c.flaggedIssue ? `\n${c.flaggedIssue}` : ""}
            </Text>
            <Text
              style={[
                styles.cellState,
                { color: c.celta5Complete && c.tpsComplete && c.assignmentsComplete ? GREEN : AMBER },
              ]}
            >
              {c.celta5Complete && c.tpsComplete && c.assignmentsComplete ? "Complete" : "Incomplete"}
            </Text>
          </View>
        ))}
        {input.candidates.length === 0 ? <Text style={styles.note}>No candidates on this course.</Text> : null}

        <Text style={styles.sectionLabel}>Cohort documents</Text>
        {input.cohortDocuments.map((d) => (
          <View key={d} style={styles.row} wrap={false}>
            <Text style={styles.cellName}>{d}</Text>
            <Text style={styles.cellMeta} />
            <Text style={[styles.cellState, { color: GREEN }]}>Live</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Centre documents</Text>
        {input.centreDocuments.map((d) => (
          <View key={d.name} style={styles.row} wrap={false}>
            <Text style={styles.cellName}>{d.name}</Text>
            <Text style={styles.cellMeta}>{d.meta}</Text>
            <Text style={[styles.cellState, { color: d.present ? GREEN : AMBER }]}>
              {d.present ? "On file" : "Not uploaded"}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Not in this pack</Text>
        <Text style={styles.note}>
          The assessor&apos;s own report — goes to Cambridge&apos;s own secure system, not here.{"\n"}
          Staff chat — trainer-only, resets on the centre&apos;s schedule.{"\n"}
          Trainee-only chat — a deliberate privacy boundary.
        </Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${input.centreName} · ${input.courseName} · page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
