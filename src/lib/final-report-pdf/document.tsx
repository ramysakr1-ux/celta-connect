import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { GRADE_DESCRIPTORS } from "@/lib/celta-criteria";
import type { FinalGrade } from "@/lib/supabase/types";

// SS9.5 -- the end-of-course final report. Structure and copy are ported
// from the center's real, already-in-use Word-doc reports (Ramy's own
// examples, ~/Downloads/EOC reports) rather than invented: front page is
// the provisional certificate, back page is the three-box full report
// (achievement areas / performance descriptor / overall comment). Real
// examples confirmed NO Cambridge logo belongs here (only the center's),
// and that a typed name is the real center's own signature convention --
// rendered here in a script font for a bit more polish, not a drawn
// signature pad (see project memory for why that's deliberately deferred).

// Read from public/ via process.cwd() rather than __dirname -- Next.js's
// bundler doesn't reliably preserve __dirname pointing at the real source
// tree for server code, but process.cwd() at the project root is a stable,
// well-established pattern for reading local files from a Next.js server
// context. Fonts live in public/fonts/ mainly so this path is guaranteed
// stable (not because they're meant to be served to the browser).
const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Newsreader", src: path.join(fontsDir, "Newsreader.ttf") });
Font.register({ family: "Karla", src: path.join(fontsDir, "Karla.ttf") });
Font.register({ family: "DancingScript", src: path.join(fontsDir, "DancingScript.ttf") });

const COLOR = {
  ink: "#2a2723",
  muted: "#7c7368",
  border: "#e2ded5",
  teal: "#1c4e52",
  gold: "#a97a2f",
  cream: "#f8f3e8",
  fail: "#9a3324",
};

const GRADE_COLOR: Record<string, string> = {
  "Pass A": COLOR.gold,
  "Pass B": COLOR.teal,
  Pass: COLOR.teal,
  Fail: COLOR.fail,
  Withdrawn: COLOR.muted,
};

// Real closing lines confirmed from actual center reports for Pass/Pass B
// ("continue to need [some] guidance..."); Pass A follows the same
// three-tier "guidance" language Appendix 2 already uses throughout
// (Pass -> Pass B "some" -> Pass A "minimal"). Fail has no such line in any
// real example -- the descriptor's own fail text stands alone.
const CLOSING_LINE: Partial<Record<FinalGrade, string>> = {
  Pass: "They will continue to need guidance to help them develop and broaden their range of skills as teachers in post.",
  "Pass B":
    "They will continue to need some guidance to help them develop and broaden their range of skills as teachers in post.",
  "Pass A":
    "They will continue to need minimal guidance to help them develop and broaden their range of skills as teachers in post.",
};

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Karla", fontSize: 10.5, color: COLOR.ink },
  logo: { position: "absolute", top: 40, right: 48, width: 90, objectFit: "contain" },
  centered: { textAlign: "center" },
  eyebrow: { fontSize: 9, letterSpacing: 1.5, color: COLOR.gold, textTransform: "uppercase", marginBottom: 24, textAlign: "center" },
  name: { fontFamily: "Newsreader", fontSize: 26, textAlign: "center", marginBottom: 16, color: COLOR.ink },
  body: { fontSize: 11, lineHeight: 1.6, textAlign: "center", marginBottom: 10, color: COLOR.ink },
  strong: { fontFamily: "Newsreader", fontSize: 11 },
  gradeLabel: { fontSize: 10, textAlign: "center", marginTop: 18, marginBottom: 6, color: COLOR.muted },
  grade: { fontFamily: "Newsreader", fontSize: 32, textAlign: "center", marginBottom: 18 },
  disclaimer: { fontSize: 9, textAlign: "center", color: COLOR.muted, marginBottom: 22, lineHeight: 1.5 },
  paragraph: { fontSize: 10, lineHeight: 1.6, textAlign: "center", color: COLOR.ink, marginBottom: 8 },
  signRow: { flexDirection: "row", justifyContent: "center", gap: 60, marginTop: 56 },
  signBlock: { alignItems: "center", width: 180 },
  signature: { fontFamily: "DancingScript", fontSize: 24, color: COLOR.teal, borderBottomWidth: 1, borderBottomColor: COLOR.border, paddingBottom: 4, marginBottom: 4, width: "100%", textAlign: "center" },
  signName: { fontSize: 9, color: COLOR.ink },
  signRole: { fontSize: 8, color: COLOR.muted },
  footer: { position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center", fontSize: 7, color: COLOR.border },

  section: { border: `1px solid ${COLOR.border}`, borderRadius: 4, padding: 16, marginBottom: 14 },
  sectionTitle: { fontFamily: "Newsreader", fontSize: 13, color: COLOR.teal, marginBottom: 8 },
  sectionIntro: { fontSize: 9, color: COLOR.muted, lineHeight: 1.5, marginBottom: 10 },
  gradeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  gradeRowLast: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 2 },
  gradeRowLabel: { fontSize: 10 },
  gradeRowValue: { fontSize: 10, fontFamily: "Newsreader" },
  descriptorIntro: { fontSize: 10, lineHeight: 1.5, marginBottom: 8, fontFamily: "Newsreader" },
  bulletRow: { flexDirection: "row", marginBottom: 6, gap: 6 },
  bulletMark: { fontSize: 9, color: COLOR.teal },
  bulletText: { fontSize: 9.5, lineHeight: 1.5, flex: 1 },
  closingLine: { fontSize: 9.5, lineHeight: 1.5, marginTop: 4, fontFamily: "Newsreader" },
  commentText: { fontSize: 10, lineHeight: 1.7 },
});

interface Signatory {
  name: string;
  role: string;
}

export interface FinalReportInput {
  traineeName: string;
  courseName: string;
  centerName: string;
  centerLogoUrl: string | null;
  courseStartDate: string;
  courseEndDate: string;
  totalHours: number;
  finalGrade: FinalGrade;
  teachingGrade: string | null;
  assignmentsGrade: string | null;
  overallComment: string | null;
  signatories: Signatory[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function renderFinalReportBuffer(input: FinalReportInput): Promise<Buffer> {
  const {
    traineeName,
    courseName,
    centerName,
    centerLogoUrl,
    courseStartDate,
    courseEndDate,
    totalHours,
    finalGrade,
    teachingGrade,
    assignmentsGrade,
    overallComment,
    signatories,
  } = input;

  const gradeColor = GRADE_COLOR[finalGrade] ?? COLOR.ink;
  const dimensionRows = GRADE_DESCRIPTORS.dimensions.filter((d) => d.name !== "Overall");
  const overallDimension = GRADE_DESCRIPTORS.dimensions.find((d) => d.name === "Overall");
  const isBandedGrade = finalGrade === "Pass" || finalGrade === "Pass B" || finalGrade === "Pass A";

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {centerLogoUrl ? <Image src={centerLogoUrl} style={styles.logo} /> : null}

        <Text style={{ marginTop: 60 }} />
        <Text style={styles.eyebrow}>{courseName}</Text>
        <Text style={styles.body}>This is to certify that</Text>
        <Text style={styles.name}>{traineeName}</Text>
        <Text style={styles.body}>
          attended a {totalHours}-hour initial teacher training course leading to the Cambridge Certificate in
          Teaching English to Speakers of Other Languages (CELTA)
        </Text>
        <Text style={styles.body}>at {centerName}</Text>
        <Text style={styles.body}>
          from {formatDate(courseStartDate)} to {formatDate(courseEndDate)}
        </Text>

        <Text style={styles.gradeLabel}>The following provisional grade was awarded</Text>
        <Text style={[styles.grade, { color: gradeColor }]}>{finalGrade.toUpperCase()}</Text>

        <Text style={styles.disclaimer}>
          This is an internal course report. The final grade is subject to confirmation by Cambridge Assessment
          English.
        </Text>

        <Text style={styles.paragraph}>
          The course included collaborative planning, peer observation and shared evaluation and feedback. Within
          this framework each candidate completed 6 hours of individually assessed teaching, and 6 hours of
          observation of experienced teachers.
        </Text>
        <Text style={styles.paragraph}>A full report is set out on the reverse of this document.</Text>

        <View style={styles.signRow}>
          {signatories.slice(0, 2).map((s) => (
            <View key={s.name} style={styles.signBlock}>
              <Text style={styles.signature}>{s.name}</Text>
              <Text style={styles.signName}>{s.name}</Text>
              <Text style={styles.signRole}>{s.role}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Generated via Connect CELTA</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        {centerLogoUrl ? <Image src={centerLogoUrl} style={[styles.logo, { width: 60 }]} /> : null}
        <Text style={{ marginTop: 40 }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements in Individual Assessment Areas</Text>
          <Text style={styles.sectionIntro}>
            These grades refer to the two assessment areas in the Cambridge CELTA Syllabus and Assessment
            Guidelines. Written assignments are graded Pass or Fail. Classroom teaching skills are graded Pass A,
            Pass B, Pass, or Fail.
          </Text>
          <View style={styles.gradeRow}>
            <Text style={styles.gradeRowLabel}>Preparing, planning and practising teaching</Text>
            <Text style={styles.gradeRowValue}>{teachingGrade ?? "--"}</Text>
          </View>
          <View style={styles.gradeRow}>
            <Text style={styles.gradeRowLabel}>Written assignments</Text>
            <Text style={styles.gradeRowValue}>{assignmentsGrade ?? "--"}</Text>
          </View>
          <View style={styles.gradeRowLast}>
            <Text style={[styles.gradeRowLabel, { fontFamily: "Newsreader" }]}>Overall recommended grade</Text>
            <Text style={[styles.gradeRowValue, { color: gradeColor }]}>{finalGrade.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Descriptor for a {finalGrade} Grade</Text>
          {isBandedGrade ? (
            <>
              {overallDimension ? (
                <Text style={styles.descriptorIntro}>{overallDimension[finalGrade as "Pass" | "Pass B" | "Pass A"]}</Text>
              ) : null}
              {dimensionRows.map((d) => (
                <View key={d.name} style={styles.bulletRow}>
                  <Text style={styles.bulletMark}>✓</Text>
                  <Text style={styles.bulletText}>{d[finalGrade as "Pass" | "Pass B" | "Pass A"]}</Text>
                </View>
              ))}
              {CLOSING_LINE[finalGrade] ? <Text style={styles.closingLine}>{CLOSING_LINE[finalGrade]}</Text> : null}
            </>
          ) : (
            <Text style={styles.descriptorIntro}>{GRADE_DESCRIPTORS.fail}</Text>
          )}
        </View>

        {overallComment ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall Comment</Text>
            <Text style={styles.commentText}>{overallComment}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>Generated via Connect CELTA</Text>
      </Page>
    </Document>
  );
}
