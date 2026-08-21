import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// Filming Consent.dc.html, verbatim -- centre template, "used only if a
// centre films" (admissions-and-close-out.md §10). Not part of ordinary
// volunteer sign-up: a volunteer already consents to the short recording
// they make THEMSELVES, which is a different act from consenting to appear
// in a filmed TP lesson. No opt-out box in the source design -- they sign
// or they don't; kept with the class register, since an assessor expects
// consent for everyone in the room, not only the learner a trainee wrote
// about. Generic Connect-branded template (no per-centre data at
// generation time) -- the source design's own header reads "Connect ·
// centre template", not a specific centre's name.
const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Newsreader", src: path.join(fontsDir, "Newsreader.ttf") });
Font.register({ family: "Karla", src: path.join(fontsDir, "Karla.ttf") });

// Hex approximations of the source design's own oklch tokens -- react-pdf
// has no oklch() support, so these are manually converted, anchored against
// this app's already-established ink/muted/gold hex mapping (see
// formal-letter-pdf/document.tsx) for the shades that reuse those exact
// tokens, and interpolated within the same warm-neutral family for the
// couple of shades unique to this design.
const COLOR = {
  ink: "#2a2723", // oklch(23.5% 0.017 65)
  inkWarm: "#3a2f22", // oklch(30% 0.042 58) -- h2s
  bodyDark: "#4f4940", // oklch(38% 0.017 65) -- main body copy
  calloutText: "#5c5040", // oklch(45% 0.04 70)
  muted: "#7c7368", // oklch(51% 0.017 70)
  mutedLight: "#8a8175", // oklch(56% 0.017 70)
  gold: "#a97a2f", // oklch(63% 0.096 72)
  border: "#ded7c9", // oklch(84% 0.016 82)
  calloutBg: "#f7f2e6", // oklch(96.5% 0.018 85)
};

const styles = StyleSheet.create({
  page: { padding: "0.85in", fontFamily: "Karla", fontSize: 11, color: COLOR.bodyDark, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingBottom: 8,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    fontSize: 9,
    color: COLOR.muted,
  },
  headerLabel: { fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" },
  callout: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: COLOR.calloutText,
    backgroundColor: COLOR.calloutBg,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.gold,
    padding: "10pt 12pt",
    marginBottom: 18,
  },
  h1: { fontFamily: "Newsreader", fontSize: 24, fontWeight: 600, lineHeight: 1.12, color: COLOR.ink, marginBottom: 10 },
  intro: { fontSize: 11.5, lineHeight: 1.55, color: COLOR.bodyDark, marginBottom: 16 },
  h2: { fontFamily: "Newsreader", fontSize: 14, fontWeight: 600, color: COLOR.inkWarm, marginBottom: 7 },
  p: { fontSize: 11, lineHeight: 1.6, color: COLOR.bodyDark, marginBottom: 9 },
  pLast: { fontSize: 11, lineHeight: 1.6, color: COLOR.bodyDark, marginBottom: 16 },
  list: { marginBottom: 16, paddingLeft: 2 },
  listItem: { flexDirection: "row", marginBottom: 5, fontSize: 11, lineHeight: 1.6, color: COLOR.bodyDark },
  bullet: { width: 12 },
  signRow: { flexDirection: "row", gap: 20, marginBottom: 14 },
  signBlock: { flex: 1, flexDirection: "column", gap: 4 },
  signLine: { height: 26, borderBottomWidth: 1, borderBottomColor: COLOR.inkWarm },
  signLabel: { fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: COLOR.muted },
  footerNote: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: COLOR.muted,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    paddingTop: 10,
  },
  footer: {
    position: "absolute",
    bottom: "0.85in",
    left: "0.85in",
    right: "0.85in",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    fontSize: 8.5,
    color: COLOR.mutedLight,
  },
});

export async function renderFilmingConsentBuffer(): Promise<Buffer> {
  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.headerLabel}>Connect · centre template</Text>
          <Text>Consent to be filmed in class</Text>
        </View>

        <View style={styles.callout}>
          <Text>
            Not part of the ordinary sign-up. A volunteer already agrees to the short recording they make
            themselves, which is a different thing. This form is only used where a centre films lessons --
            Cambridge allows up to three of the six observation hours to be filmed -- or teaches online with the
            class on camera. Give it out before the first filmed lesson, in the learner&apos;s own language.
          </Text>
        </View>

        <Text style={styles.h1}>Some of our lessons are filmed</Text>

        <Text style={styles.intro}>
          You are learning English in a class taught by teachers in training. Some of those lessons are filmed so
          the trainee teacher can watch themselves afterwards and so their tutor can assess the lesson. You will be
          in the picture, and your voice will be on the recording. This page explains what that means, and asks
          whether you agree.
        </Text>

        <Text style={styles.h2}>What is filmed, and what is not</Text>
        <Text style={styles.p}>
          The camera is pointed at the teacher and the front of the room. You will appear when you speak, when you
          work with a partner, and when the teacher comes to your table. Breaks are not filmed. Nothing outside the
          classroom is filmed.
        </Text>
        <Text style={styles.pLast}>You will always be told before a lesson is filmed. It will not happen without warning.</Text>

        <Text style={styles.h2}>Who sees it</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>The trainee teacher who taught the lesson, and their tutor.</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>The other trainee teachers on the course, when the lesson is discussed together.</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>A Cambridge assessor, if they ask to see it as part of assessing the course.</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text>Nobody else. It is not put online, not shown to the public, and not used in any advertising.</Text>
          </View>
        </View>

        <Text style={styles.h2}>How long it is kept</Text>
        <Text style={styles.pLast}>
          Recordings are kept on the centre&apos;s own secure storage until six months after the course ends, and
          then deleted. That is the same period the centre keeps the trainee teachers&apos; coursework, because a
          recording may be needed if a trainee questions their result.
        </Text>

        <Text style={[styles.h2, { marginBottom: 10 }]}>Consent</Text>
        <Text style={[styles.p, { marginBottom: 14 }]}>
          I have read this page and I agree to being filmed in class on the terms set out above. I understand I can
          withdraw my consent at any time by telling the centre, and that recordings I appear in will then be
          deleted.
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Name</Text>
          </View>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Signature and date</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Keep the signed form with the class register -- an assessor asking about a filmed lesson will expect to
          see consent for everyone in the room, not only the learner a trainee wrote about.
        </Text>

        <View style={styles.footer} fixed>
          <Text>Only needed if the centre films teaching practice.</Text>
          <Text>Template v1 · each centre edits and dates its own</Text>
        </View>
      </Page>
    </Document>
  );
}
