import "server-only";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { COLOR, closeOutPdfStyles as s, formatDate } from "./pdf-styles";

export interface ObservationsLogInput {
  traineeName: string;
  courseName: string;
  observations: {
    observation_date: string | null;
    length_minutes: number | null;
    level: string | null;
    learners_present: number | null;
    lesson_focus: string | null;
    filmed: boolean;
  }[];
}

// No existing PDF generator covered the self-reported observation log
// (build-spec.md §2's export list includes "observations" alongside TP
// records/self-evaluations/CELTA5) -- distinct from peer_observation_sheets,
// which is TP-teaching feedback already carried inside the TP record PDF.
export async function renderObservationsLogBuffer(input: ObservationsLogInput): Promise<Buffer> {
  const { traineeName, courseName, observations } = input;
  const totalMinutes = observations.reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  const filmedMinutes = observations.filter((o) => o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);

  return renderToBuffer(
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Observations log</Text>
        <Text style={s.subtitle}>
          {traineeName} &middot; {courseName}
        </Text>
        <Text style={{ fontSize: 8.5, color: COLOR.muted, marginBottom: 12 }}>
          {(totalMinutes / 60).toFixed(1)} hours total, {(filmedMinutes / 60).toFixed(1)} filmed
        </Text>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { width: "16%" }]}>Date</Text>
            <Text style={[s.th, { width: "12%" }]}>Length</Text>
            <Text style={[s.th, { width: "12%" }]}>Level</Text>
            <Text style={[s.th, { width: "10%" }]}>Filmed</Text>
            <Text style={[s.th, { width: "50%" }]}>Focus</Text>
          </View>
          {observations.length === 0 ? (
            <View style={s.tr}>
              <Text style={[s.td, { color: COLOR.muted }]}>No observations logged.</Text>
            </View>
          ) : (
            observations.map((o, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, { width: "16%" }]}>{formatDate(o.observation_date)}</Text>
                <Text style={[s.td, { width: "12%" }]}>{o.length_minutes ? `${o.length_minutes} min` : "--"}</Text>
                <Text style={[s.td, { width: "12%" }]}>{o.level ?? "--"}</Text>
                <Text style={[s.td, { width: "10%" }]}>{o.filmed ? "Yes" : "No"}</Text>
                <Text style={[s.td, { width: "50%" }]}>{o.lesson_focus ?? "--"}</Text>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  );
}
