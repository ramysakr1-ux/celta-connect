import "server-only";
import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import { COLOR, closeOutPdfStyles as s, formatDate } from "./pdf-styles";

const TYPE_LABEL: Record<string, string> = {
  input_session: "Input session",
  tp: "Teaching practice",
  assignment_due: "Assignment due",
  resubmission_due: "Resubmission due",
  milestone: "Milestone",
};

export interface TimetableAsTaughtInput {
  courseName: string;
  centerName: string;
  centerLogoUrl: string | null;
  events: { event_date: string; event_time: string | null; type: string; title: string }[];
}

export async function renderTimetableAsTaughtBuffer(input: TimetableAsTaughtInput): Promise<Buffer> {
  const { courseName, centerName, centerLogoUrl, events } = input;
  const sorted = [...events].sort((a, b) =>
    a.event_date === b.event_date ? (a.event_time ?? "").localeCompare(b.event_time ?? "") : a.event_date.localeCompare(b.event_date)
  );

  return renderToBuffer(
    <Document>
      <Page size="A4" style={s.page}>
        {centerLogoUrl ? <Image src={centerLogoUrl} style={s.logo} /> : <Text style={s.logoFallbackText}>{centerName}</Text>}
        <Text style={s.title}>Timetable as taught</Text>
        <Text style={s.subtitle}>{courseName}</Text>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { width: "20%" }]}>Date</Text>
            <Text style={[s.th, { width: "12%" }]}>Time</Text>
            <Text style={[s.th, { width: "25%" }]}>Type</Text>
            <Text style={[s.th, { width: "43%" }]}>Title</Text>
          </View>
          {sorted.length === 0 ? (
            <View style={s.tr}>
              <Text style={[s.td, { color: COLOR.muted }]}>No timetable events recorded.</Text>
            </View>
          ) : (
            sorted.map((e, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, { width: "20%" }]}>{formatDate(e.event_date)}</Text>
                <Text style={[s.td, { width: "12%" }]}>{e.event_time ?? "--"}</Text>
                <Text style={[s.td, { width: "25%" }]}>{TYPE_LABEL[e.type] ?? e.type}</Text>
                <Text style={[s.td, { width: "43%" }]}>{e.title}</Text>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  );
}
