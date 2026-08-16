import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// Certificate of attendance for a volunteer TP student who's completed a
// full level (all "sets" of a coursebook) -- a DESIGN-ONLY piece for now,
// per Ramy: the cross-course sets/level-tracking system that would
// actually trigger this doesn't exist yet, so this renders from plain
// input props rather than a real DB row. Deliberately reuses the warm
// cream/gold palette already established for the volunteer-student portal
// (/student/[token], materials-card.tsx) rather than the teal palette used
// for the trainee final report -- same person type, same visual identity.
// No Cambridge logo (Ramy: explicit), only the center's own logo. Per
// specs/README.md's "Whose brand appears where" -- this is a document that
// leaves the system, so it carries the centre's own branding only, never
// the Connect mark. Falls back to the centre's name in text where no logo
// has been uploaded, rather than falling back to a Connect mark.
const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Newsreader", src: path.join(fontsDir, "Newsreader.ttf") });
Font.register({ family: "Karla", src: path.join(fontsDir, "Karla.ttf") });
Font.register({ family: "DancingScript", src: path.join(fontsDir, "DancingScript.ttf") });

const COLOR = {
  cream: "#fdf6ec",
  ink: "#3a2e18",
  muted: "#8a6a2f",
  border: "#eddfc4",
  frame: "#c9a04a",
  gold: "#b3892f",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLOR.cream,
    fontFamily: "Karla",
    color: COLOR.ink,
    padding: 28,
  },
  frame: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLOR.frame,
    borderRadius: 4,
    padding: 6,
  },
  innerFrame: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: COLOR.frame,
    borderRadius: 2,
    paddingVertical: 44,
    paddingHorizontal: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 84, objectFit: "contain", marginBottom: 20 },
  logoFallbackText: {
    fontFamily: "Newsreader",
    fontSize: 18,
    color: COLOR.ink,
    textAlign: "center",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 3,
    color: COLOR.gold,
    textTransform: "uppercase",
    marginBottom: 28,
  },
  body: { fontSize: 12, color: COLOR.ink, textAlign: "center" },
  name: {
    fontFamily: "Newsreader",
    fontSize: 34,
    color: COLOR.ink,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 12,
    lineHeight: 1.7,
    color: COLOR.ink,
    textAlign: "center",
    maxWidth: 420,
    marginTop: 4,
  },
  centerLine: { fontSize: 12, color: COLOR.muted, textAlign: "center", marginTop: 18 },
  dateLine: { fontSize: 10.5, color: COLOR.muted, textAlign: "center", marginTop: 6 },
  signRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 56, marginTop: 44 },
  signBlock: { alignItems: "center", width: 170 },
  signature: {
    fontFamily: "DancingScript",
    fontSize: 22,
    color: COLOR.gold,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingBottom: 4,
    marginBottom: 4,
    width: "100%",
    textAlign: "center",
  },
  signName: { fontSize: 9, color: COLOR.ink },
  platformCredit: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 7,
    letterSpacing: 0.6,
    color: "#a9a094",
  },
  signRole: { fontSize: 8, color: COLOR.muted },
});

interface Signatory {
  name: string;
  role: string;
}

export interface CertificateInput {
  volunteerName: string;
  levelName: string;
  centerName: string;
  centerLogoUrl: string | null;
  completionDate: string;
  signatories: Signatory[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function renderCertificateBuffer(input: CertificateInput): Promise<Buffer> {
  const { volunteerName, levelName, centerName, centerLogoUrl, completionDate, signatories } = input;

  return renderToBuffer(
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.innerFrame}>
            {centerLogoUrl ? (
              <Image src={centerLogoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.logoFallbackText}>{centerName}</Text>
            )}
            <Text style={styles.eyebrow}>Certificate of Attendance</Text>

            <Text style={styles.body}>This certifies that</Text>
            <Text style={styles.name}>{volunteerName}</Text>
            <Text style={styles.paragraph}>
              has completed {levelName} through regular attendance of English lessons taught by CELTA trainees
              on teaching practice
            </Text>
            <Text style={styles.centerLine}>at {centerName}</Text>
            <Text style={styles.dateLine}>{formatDate(completionDate)}</Text>

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

          {/* Ramy, 2026-08-16: "We can have Connect at the bottom, small one."
              Outside the inner frame and deliberately quiet -- the certificate
              belongs to the centre and to the person named on it, and the
              platform that printed it is a footnote, not a party to the
              achievement. Still no Cambridge logo: this is not a Cambridge
              award. */}
          <Text style={styles.platformCredit}>Issued through Connect</Text>
        </View>
      </Page>
    </Document>
  );
}
