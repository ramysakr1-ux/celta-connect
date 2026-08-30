import "server-only";
import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import { COLOR, closeOutPdfStyles as s } from "./pdf-styles";
import type { TpGlyphSlot } from "@/lib/tp-grades";

const GRADE_GLYPH: Record<string, string> = {
  above_standard: "+",
  to_standard: "✓",
  not_to_standard: "✗",
};

export interface GradesReportCandidate {
  name: string;
  tpGlyphs: TpGlyphSlot[];
  provisionalLabel: string;
  recommendedGrade: string | null;
  outstanding: string;
  planningStrengths: string[];
  planningActionPoints: string[];
  teachingStrengths: string[];
  teachingActionPoints: string[];
}

export interface GradesReportInput {
  courseName: string;
  centerName: string;
  centerLogoUrl: string | null;
  candidates: GradesReportCandidate[];
}

function StrengthLine({ label, items }: { label: string; items: string[] }) {
  return (
    <Text style={{ fontSize: 8, marginBottom: 3, color: COLOR.ink }}>
      <Text style={{ color: COLOR.muted }}>{label}: </Text>
      {items.length > 0 ? items.join(", ") : "None"}
    </Text>
  );
}

export async function renderGradesReportBuffer(input: GradesReportInput): Promise<Buffer> {
  const { courseName, centerName, centerLogoUrl, candidates } = input;

  return renderToBuffer(
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {centerLogoUrl ? <Image src={centerLogoUrl} style={s.logo} /> : <Text style={s.logoFallbackText}>{centerName}</Text>}
        <Text style={s.title}>Grade form -- cohort sheet</Text>
        <Text style={s.subtitle}>{courseName}</Text>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { width: 130 }]}>Candidate</Text>
            {Array.from({ length: 8 }, (_, i) => (
              <Text key={i} style={[s.th, { width: 28, textAlign: "center" }]}>
                TP{i + 1}
              </Text>
            ))}
            <Text style={[s.th, { width: 90 }]}>Provisional</Text>
            <Text style={[s.th, { width: 90 }]}>Recommended</Text>
            <Text style={[s.th, { flex: 1 }]}>Outstanding</Text>
          </View>
          {candidates.map((c, i) => (
            <View key={i} style={s.tr}>
              <Text style={[s.td, { width: 130 }]}>{c.name}</Text>
              {c.tpGlyphs.map((g) => (
                <Text key={g.tpNumber} style={[s.td, { width: 28, textAlign: "center" }]}>
                  {g.grade ? GRADE_GLYPH[g.grade] : "·"}
                </Text>
              ))}
              <Text style={[s.td, { width: 90 }]}>{c.provisionalLabel}</Text>
              <Text style={[s.td, { width: 90 }]}>{c.recommendedGrade ?? "Not set"}</Text>
              <Text style={[s.td, { flex: 1, color: c.outstanding ? COLOR.gold : COLOR.muted }]}>{c.outstanding || "--"}</Text>
            </View>
          ))}
        </View>
      </Page>

      {candidates.map((c, i) => (
        <Page key={i} size="A4" style={s.page}>
          <Text style={s.title}>{c.name}</Text>
          <Text style={s.subtitle}>{courseName}</Text>

          <Text style={s.sectionTitle}>Planning</Text>
          <StrengthLine label="Strengths" items={c.planningStrengths} />
          <StrengthLine label="Action points" items={c.planningActionPoints} />

          <Text style={s.sectionTitle}>Teaching</Text>
          <StrengthLine label="Strengths" items={c.teachingStrengths} />
          <StrengthLine label="Action points" items={c.teachingActionPoints} />

          <Text style={s.sectionTitle}>Grade</Text>
          <Text style={{ fontSize: 9, color: COLOR.ink }}>Provisional: {c.provisionalLabel}</Text>
          <Text style={{ fontSize: 9, color: COLOR.ink, marginTop: 2 }}>Recommended: {c.recommendedGrade ?? "Not set"}</Text>
        </Page>
      ))}
    </Document>
  );
}
