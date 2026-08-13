import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// specs/build-spec.md §3 "Withdrawal -- requires a signed letter (the app
// generates it; see Enrolment Forms.dc.html)". That reference file isn't
// available in this codebase to copy exact wording from, so this is
// honest, plain confirmation copy rather than a fabricated match to the
// real centre document -- reuses the same visual identity as the final
// report (src/lib/final-report-pdf/document.tsx: centre-branded only, no
// Connect mark, since this document also leaves the system).
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
};

const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: "Karla", fontSize: 10.5, color: COLOR.ink, backgroundColor: "#ffffff" },
  logo: { width: 56, objectFit: "contain", marginBottom: 18 },
  logoFallbackText: { fontFamily: "Newsreader", fontSize: 15, color: COLOR.ink, marginBottom: 18 },
  date: { fontSize: 9.5, color: COLOR.muted, marginBottom: 24 },
  title: { fontFamily: "Newsreader", fontSize: 17, color: COLOR.ink, marginBottom: 18 },
  paragraph: { fontSize: 10.5, lineHeight: 1.65, marginBottom: 12, color: COLOR.ink },
  label: { fontSize: 8.5, letterSpacing: 1, textTransform: "uppercase", color: COLOR.muted, marginBottom: 2 },
  value: { fontSize: 10.5, marginBottom: 10, color: COLOR.ink },
  divider: { height: 0.75, backgroundColor: COLOR.border, marginVertical: 20 },
  signRow: { flexDirection: "row", gap: 40, marginTop: 36 },
  signBlock: { alignItems: "flex-start", width: 200 },
  signature: {
    fontFamily: "DancingScript",
    fontSize: 20,
    color: COLOR.teal,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingBottom: 4,
    marginBottom: 4,
    width: "100%",
  },
  signName: { fontSize: 8.5, color: COLOR.ink },
  signRole: { fontSize: 7.5, color: COLOR.muted },
});

export interface WithdrawalLetterInput {
  traineeName: string;
  courseName: string;
  centerName: string;
  centerLogoUrl: string | null;
  courseStartDate: string;
  courseEndDate: string;
  withdrawnAt: string;
  reportable: boolean;
  note: string | null;
  issuedBy: { name: string; role: string } | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function renderWithdrawalLetterBuffer(input: WithdrawalLetterInput): Promise<Buffer> {
  const { traineeName, courseName, centerName, centerLogoUrl, courseStartDate, courseEndDate, withdrawnAt, reportable, note, issuedBy } = input;

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {centerLogoUrl ? <Image src={centerLogoUrl} style={styles.logo} /> : <Text style={styles.logoFallbackText}>{centerName}</Text>}

        <Text style={styles.date}>{formatDate(withdrawnAt)}</Text>
        <Text style={styles.title}>Confirmation of withdrawal</Text>

        <Text style={styles.paragraph}>
          This letter confirms that <Text style={{ fontFamily: "Newsreader" }}>{traineeName}</Text> has withdrawn from
          the Cambridge CELTA course at {centerName}, and is no longer an active candidate on this course from the
          date above.
        </Text>

        <View>
          <Text style={styles.label}>Course</Text>
          <Text style={styles.value}>
            {courseName} ({formatDate(courseStartDate)} &ndash; {formatDate(courseEndDate)})
          </Text>
        </View>

        <View>
          <Text style={styles.label}>Cambridge reporting status</Text>
          <Text style={styles.value}>
            {reportable
              ? "This candidate's entry was already submitted to Cambridge Assessment English. This withdrawal will be recorded on the course's outcome as Withdrawn."
              : "This candidate's entry had not yet been submitted to Cambridge Assessment English. This withdrawal is an internal record only."}
          </Text>
        </View>

        {note ? (
          <View>
            <Text style={styles.label}>Note on record</Text>
            <Text style={styles.value}>{note}</Text>
          </View>
        ) : null}

        <Text style={styles.paragraph}>
          The candidate&apos;s portfolio and course record up to this date have been kept, not deleted, and remain
          available to the centre and to Cambridge Assessment English as required.
        </Text>

        <View style={styles.divider} />

        <View style={styles.signRow}>
          <View style={styles.signBlock}>
            <Text style={styles.signature}>{issuedBy?.name ?? centerName}</Text>
            <Text style={styles.signName}>{issuedBy?.name ?? centerName}</Text>
            <Text style={styles.signRole}>{issuedBy?.role ?? "On behalf of the centre"}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
