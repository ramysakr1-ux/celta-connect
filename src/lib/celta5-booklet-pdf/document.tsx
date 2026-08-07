import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { CELTA_CRITERIA_SECTIONS, CRITERIA_LABELS } from "@/lib/celta-criteria";
import { MIN_LEVELS_REQUIRED } from "@/lib/course-progress";
import type { SignatureLedgerRow } from "@/lib/celta5-signatures";
import type { Database } from "@/lib/supabase/types";

type MatrixRow = Database["public"]["Tables"]["celta5_matrix"]["Row"];
type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

// Checkpoint 7 area 3 -- the certified CELTA 5 booklet, one candidate at a
// time (bulk export/Drive filing is build-spec item 20's Close-out
// checkpoint, not this one). Assembled entirely from data the app already
// holds -- nothing here is typed twice. Per specs/README's "whose brand
// appears where" rule this document leaves the system (goes in the
// candidate's portfolio / to Cambridge), so it carries the centre's own
// branding only, same convention as final-report-pdf and
// assignment-cover-sheet-pdf.
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

const RATING_COLOR: Record<string, string> = {
  "S+": COLOR.teal,
  S: COLOR.teal,
  N: COLOR.fail,
  X: COLOR.muted,
};

const SIGNATURE_STATE_LABEL: Record<SignatureLedgerRow["state"], string> = {
  signed: "Signed",
  ready: "Ready",
  open: "Open",
  locked: "Locked",
};

const SIGNATURE_STATE_COLOR: Record<SignatureLedgerRow["state"], string> = {
  signed: COLOR.teal,
  ready: COLOR.gold,
  open: COLOR.muted,
  locked: COLOR.border,
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Karla", fontSize: 9.5, color: COLOR.ink },
  logoTopRight: { position: "absolute", top: 32, right: 40, width: 48, objectFit: "contain" },

  coverPage: { padding: 26, fontFamily: "Karla", fontSize: 10.5, color: COLOR.ink, backgroundColor: COLOR.cream },
  frame: { flex: 1, borderWidth: 1.25, borderColor: COLOR.gold, borderRadius: 3, padding: 5 },
  innerFrame: { flex: 1, borderWidth: 0.75, borderColor: COLOR.gold, borderRadius: 2, paddingVertical: 60, paddingHorizontal: 56, alignItems: "center" },
  logo: { width: 64, objectFit: "contain", marginBottom: 18 },
  logoFallbackText: { fontFamily: "Newsreader", fontSize: 16, color: COLOR.ink, textAlign: "center", marginBottom: 18 },
  eyebrow: { fontSize: 10.5, letterSpacing: 3, color: COLOR.gold, textTransform: "uppercase", textAlign: "center" },
  name: { fontFamily: "Newsreader", fontSize: 28, textAlign: "center", marginTop: 14, marginBottom: 14, color: COLOR.ink },
  coverMetaRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 20 },
  coverMetaBlock: { alignItems: "center" },
  coverMetaLabel: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: COLOR.muted },
  coverMetaValue: { fontSize: 10, color: COLOR.ink, marginTop: 3 },
  coverNote: { fontSize: 8.5, textAlign: "center", color: COLOR.muted, marginTop: 40, lineHeight: 1.5, maxWidth: 380 },

  header: { borderBottomWidth: 0.75, borderBottomColor: COLOR.gold, paddingBottom: 8, marginBottom: 16 },
  headerTitle: { fontFamily: "Newsreader", fontSize: 14, color: COLOR.teal },
  headerMeta: { fontSize: 8, color: COLOR.muted, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" },

  section: { border: `1px solid ${COLOR.border}`, borderRadius: 4, padding: 12, marginBottom: 10 },
  sectionTitle: { fontFamily: "Newsreader", fontSize: 12, color: COLOR.teal, marginBottom: 6 },
  topicTitle: { fontFamily: "Newsreader", fontSize: 10, color: COLOR.ink, marginTop: 8, marginBottom: 4 },

  criteriaRow: { borderBottomWidth: 0.5, borderBottomColor: COLOR.border, paddingVertical: 3 },
  criteriaText: { fontSize: 8.5, color: COLOR.ink },
  criteriaRatings: { flexDirection: "row", gap: 14, marginTop: 2 },
  criteriaRatingLabel: { fontSize: 7.5, color: COLOR.muted },
  criteriaRatingValue: { fontSize: 8.5, fontFamily: "Newsreader" },

  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: COLOR.border },
  statLabel: { fontSize: 9, color: COLOR.muted },
  statValue: { fontSize: 9, color: COLOR.ink },

  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: COLOR.gold, paddingBottom: 3, marginBottom: 3 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.border, paddingVertical: 3 },
  th: { fontSize: 7.5, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  td: { fontSize: 8.5, color: COLOR.ink },

  ledgerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: COLOR.border },
  ledgerLabel: { fontSize: 9, color: COLOR.ink },
  ledgerPill: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 8, fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.5 },

  paragraph: { fontSize: 9, lineHeight: 1.6, color: COLOR.ink, marginBottom: 4 },
});

interface CriteriaMatrixInput {
  candidateStatus: MatrixRow["candidate_status"];
  tutorStatusStage2: MatrixRow["tutor_status_stage2"];
  tutorStatusStage3: MatrixRow["tutor_status_stage3"];
}

export interface Celta5BookletInput {
  traineeName: string;
  courseName: string;
  centerName: string;
  centerLogoUrl: string | null;
  courseStartDate: string;
  courseEndDate: string;
  tutorNames: string[];
  matrixByCode: Record<string, CriteriaMatrixInput>;
  record: Celta5Record;
  attendance: { hoursAttended: number; totalHours: number };
  observations: { liveHours: number; filmedHours: number };
  assessedTp: { hoursAssessed: number; tpsTaught: number; levels: string[] };
  assignments: { title: string; status: string; grade: string | null }[];
  ledger: SignatureLedgerRow[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PageHeader({ traineeName, courseName, logoUrl }: { traineeName: string; courseName: string; logoUrl: string | null }) {
  return (
    <>
      {logoUrl ? <Image src={logoUrl} style={styles.logoTopRight} /> : null}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{traineeName}</Text>
        <Text style={styles.headerMeta}>{courseName} · CELTA 5 Record</Text>
      </View>
    </>
  );
}

export async function renderCelta5BookletBuffer(input: Celta5BookletInput): Promise<Buffer> {
  const {
    traineeName,
    courseName,
    centerName,
    centerLogoUrl,
    courseStartDate,
    courseEndDate,
    tutorNames,
    matrixByCode,
    record,
    attendance,
    observations,
    assessedTp,
    assignments,
    ledger,
  } = input;

  return renderToBuffer(
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.frame}>
          <View style={styles.innerFrame}>
            {centerLogoUrl ? <Image src={centerLogoUrl} style={styles.logo} /> : <Text style={styles.logoFallbackText}>{centerName}</Text>}
            <Text style={styles.eyebrow}>CELTA 5 Record</Text>
            <Text style={styles.name}>{traineeName}</Text>
            <View style={styles.coverMetaRow}>
              <View style={styles.coverMetaBlock}>
                <Text style={styles.coverMetaLabel}>Course</Text>
                <Text style={styles.coverMetaValue}>{courseName}</Text>
              </View>
              <View style={styles.coverMetaBlock}>
                <Text style={styles.coverMetaLabel}>Centre</Text>
                <Text style={styles.coverMetaValue}>{centerName}</Text>
              </View>
            </View>
            <View style={styles.coverMetaRow}>
              <View style={styles.coverMetaBlock}>
                <Text style={styles.coverMetaLabel}>Dates</Text>
                <Text style={styles.coverMetaValue}>
                  {formatDate(courseStartDate)} -- {formatDate(courseEndDate)}
                </Text>
              </View>
              <View style={styles.coverMetaBlock}>
                <Text style={styles.coverMetaLabel}>Tutors</Text>
                <Text style={styles.coverMetaValue}>{tutorNames.join(", ") || "--"}</Text>
              </View>
            </View>
            <Text style={styles.coverNote}>
              This is a certified record of the candidate&apos;s CELTA 5 portfolio, generated from the course&apos;s own
              records. All signatures listed on the final page were captured as typed names, timestamped at the
              moment each party signed.
            </Text>
          </View>
        </View>
      </Page>

      {/* Criteria matrix */}
      <Page size="A4" style={styles.page}>
        <PageHeader traineeName={traineeName} courseName={courseName} logoUrl={centerLogoUrl} />
        <Text style={styles.sectionTitle}>Criteria ratings</Text>
        {CELTA_CRITERIA_SECTIONS.map(({ section, title, codes }) => (
          <View key={section} wrap={false}>
            <Text style={styles.topicTitle}>
              Topic {section} -- {title}
            </Text>
            {codes.map((code) => {
              const m = matrixByCode[code];
              return (
                <View key={code} style={styles.criteriaRow}>
                  <Text style={styles.criteriaText}>
                    {code}
                    {CRITERIA_LABELS[code] ? ` -- ${CRITERIA_LABELS[code]}` : ""}
                  </Text>
                  <View style={styles.criteriaRatings}>
                    <Text style={styles.criteriaRatingLabel}>
                      Candidate:{" "}
                      <Text style={[styles.criteriaRatingValue, { color: m?.candidateStatus ? RATING_COLOR[m.candidateStatus] : COLOR.muted }]}>
                        {m?.candidateStatus ?? "--"}
                      </Text>
                    </Text>
                    <Text style={styles.criteriaRatingLabel}>
                      Tutor (Stage 2):{" "}
                      <Text style={[styles.criteriaRatingValue, { color: m?.tutorStatusStage2 ? RATING_COLOR[m.tutorStatusStage2] : COLOR.muted }]}>
                        {m?.tutorStatusStage2 ?? "--"}
                      </Text>
                    </Text>
                    {record.stage3_required ? (
                      <Text style={styles.criteriaRatingLabel}>
                        Tutor (Stage 3):{" "}
                        <Text style={[styles.criteriaRatingValue, { color: m?.tutorStatusStage3 ? RATING_COLOR[m.tutorStatusStage3] : COLOR.muted }]}>
                          {m?.tutorStatusStage3 ?? "--"}
                        </Text>
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </Page>

      {/* Records */}
      <Page size="A4" style={styles.page}>
        <PageHeader traineeName={traineeName} courseName={courseName} logoUrl={centerLogoUrl} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Hours attended</Text>
            <Text style={styles.statValue}>
              {attendance.hoursAttended} of {attendance.totalHours}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observations of experienced teachers</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Live</Text>
            <Text style={styles.statValue}>{observations.liveHours.toFixed(1)} hrs</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Filmed (capped at 3 hrs toward the 6-hour total)</Text>
            <Text style={styles.statValue}>{observations.filmedHours.toFixed(1)} hrs</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assessed teaching practice</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>TPs taught / hours assessed</Text>
            <Text style={styles.statValue}>
              {assessedTp.tpsTaught} / {assessedTp.hoursAssessed.toFixed(1)} hrs
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Levels taught (at least {MIN_LEVELS_REQUIRED} required)</Text>
            <Text style={styles.statValue}>{assessedTp.levels.join(", ") || "none yet"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Written assignments</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { flex: 2 }]}>Assignment</Text>
              <Text style={[styles.th, { flex: 1 }]}>Status</Text>
              <Text style={[styles.th, { flex: 1 }]}>Grade</Text>
            </View>
            {assignments.map((a) => (
              <View key={a.title} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 2 }]}>{a.title}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{a.status}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{a.grade ?? "--"}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>

      {/* Stage summaries + signatures */}
      <Page size="A4" style={styles.page}>
        <PageHeader traineeName={traineeName} courseName={courseName} logoUrl={centerLogoUrl} />

        {record.stage1_strengths || record.stage1_action_plan ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stage One</Text>
            {record.stage1_strengths ? <Text style={styles.paragraph}>Strengths: {record.stage1_strengths}</Text> : null}
            {record.stage1_action_plan ? <Text style={styles.paragraph}>Action plan: {record.stage1_action_plan}</Text> : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stage Two -- overall</Text>
          <Text style={styles.paragraph}>Candidate: {record.stage2_candidate_overall ?? "--"}</Text>
          <Text style={styles.paragraph}>Tutor: {record.stage2_tutor_overall ?? "--"}</Text>
          {record.stage2_tutor_notes ? <Text style={styles.paragraph}>{record.stage2_tutor_notes}</Text> : null}
        </View>

        {record.stage3_required ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stage Three -- overall</Text>
            <Text style={styles.paragraph}>Tutor: {record.stage3_tutor_overall ?? "--"}</Text>
            {record.stage3_tutor_notes ? <Text style={styles.paragraph}>{record.stage3_tutor_notes}</Text> : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          {ledger.map((row) => (
            <View key={row.key} style={styles.ledgerRow}>
              <Text style={styles.ledgerLabel}>{row.label}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 7.5, color: COLOR.muted }}>{formatDateTime(row.at)}</Text>
                <Text style={[styles.ledgerPill, { color: SIGNATURE_STATE_COLOR[row.state], borderWidth: 0.75, borderColor: SIGNATURE_STATE_COLOR[row.state] }]}>
                  {SIGNATURE_STATE_LABEL[row.state]}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
