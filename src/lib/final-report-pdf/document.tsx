import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Image, Svg, Path, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
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
//
// Front-page treatment (2026-08-05) borrows the ornamental double-border
// frame + centered-logo + corner-mark technique from the volunteer
// certificate (src/lib/certificate-pdf/document.tsx), but keeps this
// document's own established teal/gold identity rather than that
// certificate's cream/gold palette -- Ramy's own principle from that build:
// same technique, different person type, so a different (but still this
// app's own) visual identity. Both pages stay portrait A4 -- these are
// real double-sided printed reports, and a landscape front page would break
// that pairing.

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

// Wordmark tile hex equivalents of --color-ink-warm / lifted-gold /
// --color-card (react-pdf has no CSSOM) -- same values as src/app/icon.tsx
// and src/lib/certificate-pdf/document.tsx.
const MARK_COLOR = { tile: "#3e2818", gold: "#cc9140", card: "#fefdfa" };

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

const CORNER_SIZE = 22;

const styles = StyleSheet.create({
  // -- Front page (certificate) --
  coverPage: { padding: 26, fontFamily: "Karla", fontSize: 10.5, color: COLOR.ink, backgroundColor: COLOR.cream },
  frame: { flex: 1, borderWidth: 1.25, borderColor: COLOR.gold, borderRadius: 3, padding: 5 },
  innerFrame: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: COLOR.gold,
    borderRadius: 2,
    paddingVertical: 40,
    paddingHorizontal: 56,
    alignItems: "center",
  },
  cornerMark: { position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE, borderColor: COLOR.gold },
  cornerTL: { top: -1, left: -1, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { top: -1, right: -1, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cornerBL: { bottom: -1, left: -1, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  logo: { width: 64, objectFit: "contain", marginBottom: 18 },
  eyebrow: { fontSize: 10.5, letterSpacing: 3, color: COLOR.gold, textTransform: "uppercase", textAlign: "center" },
  courseLine: { fontSize: 9, color: COLOR.muted, textAlign: "center", marginTop: 4 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, marginBottom: 18 },
  dividerRule: { width: 64, height: 0.75, backgroundColor: COLOR.gold },
  dividerMark: { fontSize: 9, color: COLOR.gold },
  body: { fontSize: 11, lineHeight: 1.6, textAlign: "center", marginBottom: 8, color: COLOR.ink },
  name: { fontFamily: "Newsreader", fontSize: 30, textAlign: "center", marginBottom: 14, color: COLOR.ink },
  gradeLabel: { fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", textAlign: "center", marginTop: 22, marginBottom: 10, color: COLOR.muted },
  gradeBadge: { borderWidth: 1.25, borderRadius: 40, paddingVertical: 8, paddingHorizontal: 30, marginBottom: 16 },
  grade: { fontFamily: "Newsreader", fontSize: 26, textAlign: "center" },
  disclaimer: { fontSize: 8.5, textAlign: "center", color: COLOR.muted, marginBottom: 20, lineHeight: 1.5, maxWidth: 380 },
  paragraph: { fontSize: 9.5, lineHeight: 1.6, textAlign: "center", color: COLOR.ink, marginBottom: 6, maxWidth: 400 },
  signRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 24, rowGap: 28, marginTop: 40 },
  signBlock: { alignItems: "center", width: 150 },
  signature: {
    fontFamily: "DancingScript",
    fontSize: 20,
    color: COLOR.teal,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingBottom: 4,
    marginBottom: 4,
    width: "100%",
    textAlign: "center",
  },
  signName: { fontSize: 8.5, color: COLOR.ink },
  signRole: { fontSize: 7.5, color: COLOR.muted },
  credit: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  creditTile: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: MARK_COLOR.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  creditText: { fontSize: 7.5, color: COLOR.ink },

  // -- Back page (report) --
  page: { padding: 48, fontFamily: "Karla", fontSize: 10.5, color: COLOR.ink },
  logoTopRight: { position: "absolute", top: 40, right: 48, width: 60, objectFit: "contain" },
  reportHeader: { borderBottomWidth: 0.75, borderBottomColor: COLOR.gold, paddingBottom: 10, marginBottom: 22 },
  reportHeaderName: { fontFamily: "Newsreader", fontSize: 15, color: COLOR.ink },
  reportHeaderMeta: { fontSize: 8, color: COLOR.muted, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" },
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
  footer: { position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center", fontSize: 7, color: COLOR.border },
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

function CornerMarks() {
  return (
    <>
      <View style={[styles.cornerMark, styles.cornerTL]} />
      <View style={[styles.cornerMark, styles.cornerTR]} />
      <View style={[styles.cornerMark, styles.cornerBL]} />
      <View style={[styles.cornerMark, styles.cornerBR]} />
    </>
  );
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
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.frame}>
          <CornerMarks />
          <View style={styles.innerFrame}>
            {centerLogoUrl ? <Image src={centerLogoUrl} style={styles.logo} /> : null}
            <Text style={styles.eyebrow}>Final Course Report</Text>
            <Text style={styles.courseLine}>{courseName}</Text>

            <View style={styles.divider}>
              <View style={styles.dividerRule} />
              <Text style={styles.dividerMark}>❖</Text>
              <View style={styles.dividerRule} />
            </View>

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
            <View style={[styles.gradeBadge, { borderColor: gradeColor }]}>
              <Text style={[styles.grade, { color: gradeColor }]}>{finalGrade.toUpperCase()}</Text>
            </View>

            <Text style={styles.disclaimer}>
              This is an internal course report. The final grade is subject to confirmation by Cambridge Assessment
              English.
            </Text>

            <Text style={styles.paragraph}>
              The course included collaborative planning, peer observation and shared evaluation and feedback.
              Within this framework each candidate completed 6 hours of individually assessed teaching, and 6 hours
              of observation of experienced teachers.
            </Text>
            <Text style={styles.paragraph}>A full report is set out on the reverse of this document.</Text>

            <View style={styles.signRow}>
              {signatories.map((s) => (
                <View key={s.name} style={styles.signBlock}>
                  <Text style={styles.signature}>{s.name}</Text>
                  <Text style={styles.signName}>{s.name}</Text>
                  <Text style={styles.signRole}>{s.role}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.credit}>
          <View style={styles.creditTile}>
            <Svg width={7.6} height={4.4} viewBox="8 30 104 60">
              <Path
                d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8"
                stroke={MARK_COLOR.gold}
                strokeWidth={13}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8"
                stroke={MARK_COLOR.card}
                strokeWidth={13}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </View>
          <Text style={styles.creditText}>Connect</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        {centerLogoUrl ? <Image src={centerLogoUrl} style={styles.logoTopRight} /> : null}

        <View style={styles.reportHeader}>
          <Text style={styles.reportHeaderName}>{traineeName}</Text>
          <Text style={styles.reportHeaderMeta}>
            {courseName} · Final Report
          </Text>
        </View>

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

        <Text style={styles.footer}>Generated via Connect</Text>
      </Page>
    </Document>
  );
}
