import "server-only";
import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// Letters.dc.html, "written by the system, signed by a person" -- one
// shared letter shape (letterhead, facts, drafted body, optional list,
// closing, signatures, filed note) reused by the Fail-risk, assignment-
// warning, deferral, and (rebuilt) withdrawal letters, since what differs
// between them is the data filling the template, not the template itself.
const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Newsreader", src: path.join(fontsDir, "Newsreader.ttf") });
Font.register({ family: "Karla", src: path.join(fontsDir, "Karla.ttf") });

// Hex approximations of the source design's oklch tokens, anchored against
// this app's already-established ink/muted/gold/border hex mapping (the
// original single-purpose withdrawal letter used these same anchors) --
// react-pdf has no oklch() support.
const COLOR = {
  ink: "#2a2723", // oklch(23.5% 0.017 65)
  inkWarm: "#3a2f22", // oklch(30% 0.042 58)
  muted: "#7c7368", // oklch(51% 0.017 70)
  gold: "#a97a2f", // oklch(63% 0.096 72) / oklch(60% 0.11 70) family
  border: "#e2ded5", // oklch(89.5% 0.012 82)
  listBg: "#f8f3e8", // oklch(97.8% 0.008 85)
};

const styles = StyleSheet.create({
  page: { padding: "0.85in 0.9in", fontFamily: "Karla", fontSize: 11, color: COLOR.ink, backgroundColor: "#ffffff" },
  letterhead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 15,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.inkWarm,
  },
  centerName: { fontSize: 15, fontWeight: 600, color: COLOR.inkWarm, marginBottom: 4 },
  centerSubtitle: { fontSize: 11, color: COLOR.muted },
  logo: { width: 72, height: 30, objectFit: "contain" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  kicker: { fontSize: 9, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: COLOR.muted, marginBottom: 5 },
  docTitle: { fontFamily: "Newsreader", fontSize: 21, fontWeight: 600, lineHeight: 1.2, color: COLOR.inkWarm },
  dateBlock: { alignItems: "flex-end" },
  dateLabel: { fontSize: 11, color: COLOR.muted },
  factsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 12,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  factItem: { width: "50%", flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 6 },
  factLabel: { fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: COLOR.muted, width: 88 },
  factValue: { fontSize: 11, color: COLOR.ink },
  paragraph: { fontSize: 12, lineHeight: 1.65, color: COLOR.ink, marginBottom: 12 },
  listBox: { backgroundColor: COLOR.listBg, borderRadius: 4, padding: "13pt 15pt", marginBottom: 16 },
  listTitle: { fontSize: 9, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: COLOR.muted, marginBottom: 8 },
  listItem: { flexDirection: "row", gap: 9, marginBottom: 7 },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLOR.gold, marginTop: 5 },
  listItemText: { flex: 1, fontSize: 11.5, lineHeight: 1.55, color: COLOR.ink },
  signRow: { flexDirection: "row", gap: 24, marginTop: 22, marginBottom: 10 },
  signBlock: { flex: 1, flexDirection: "column", gap: 5 },
  signLine: { minHeight: 22, borderBottomWidth: 1, borderBottomColor: COLOR.inkWarm, justifyContent: "flex-end" },
  signValue: { fontSize: 11, paddingBottom: 3 },
  signLabel: { fontSize: 8.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: COLOR.muted },
  filedNote: { fontSize: 9.5, lineHeight: 1.6, color: COLOR.muted, marginTop: 6 },
});

export interface FormalLetterInput {
  centerName: string;
  centerSubtitle: string;
  centerLogoUrl: string | null;
  kicker: string;
  docTitle: string;
  dateLabel: string;
  dayLine: string | null;
  facts: { label: string; value: string }[];
  body: string[];
  list?: { title: string; items: string[] };
  closing?: string;
  signatures: { label: string; value: string; filled: boolean }[];
  filedNote: string;
}

export async function renderFormalLetterBuffer(input: FormalLetterInput): Promise<Buffer> {
  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <View>
            <Text style={styles.centerName}>{input.centerName}</Text>
            <Text style={styles.centerSubtitle}>{input.centerSubtitle}</Text>
          </View>
          {/* react-pdf's Image is a PDF primitive, not an HTML <img> -- it has no alt prop; jsx-a11y can't tell the two apart. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {input.centerLogoUrl ? <Image src={input.centerLogoUrl} style={styles.logo} /> : null}
        </View>

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.kicker}>{input.kicker}</Text>
            <Text style={styles.docTitle}>{input.docTitle}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>{input.dateLabel}</Text>
            {input.dayLine ? <Text style={styles.dateLabel}>{input.dayLine}</Text> : null}
          </View>
        </View>

        <View style={styles.factsGrid}>
          {input.facts.map((f, i) => (
            <View key={i} style={styles.factItem}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
        </View>

        {input.body.map((para, i) => (
          <Text key={i} style={styles.paragraph}>
            {para}
          </Text>
        ))}

        {input.list && input.list.items.length > 0 ? (
          <View style={styles.listBox}>
            <Text style={styles.listTitle}>{input.list.title}</Text>
            {input.list.items.map((item, i) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.bullet} />
                <Text style={styles.listItemText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {input.closing ? <Text style={styles.paragraph}>{input.closing}</Text> : null}

        <View style={styles.signRow}>
          {input.signatures.map((sig, i) => (
            <View key={i} style={styles.signBlock}>
              <View style={styles.signLine}>
                <Text style={[styles.signValue, { color: sig.filled ? COLOR.ink : COLOR.muted }]}>{sig.value}</Text>
              </View>
              <Text style={styles.signLabel}>{sig.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.filedNote}>{input.filedNote}</Text>
      </Page>
    </Document>
  );
}
