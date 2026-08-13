import "server-only";
import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import { COLOR, closeOutPdfStyles as s, formatDate } from "./pdf-styles";

export interface AttendanceRegisterInput {
  courseName: string;
  centerName: string;
  centerLogoUrl: string | null;
  events: { id: string; event_date: string }[];
  volunteers: { id: string; name: string; level: string | null }[];
  attendance: { volunteer_student_id: string; timetable_event_id: string }[];
}

export async function renderAttendanceRegisterBuffer(input: AttendanceRegisterInput): Promise<Buffer> {
  const { courseName, centerName, centerLogoUrl, events, volunteers, attendance } = input;
  const attendedSet = new Set(attendance.map((a) => `${a.volunteer_student_id}:${a.timetable_event_id}`));
  const sortedEvents = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date));
  // Same 30px-ish per-column budget the on-screen grid uses -- past ~14
  // sessions a single landscape A4 row can't fit every date column legibly,
  // so this wraps onto a fresh page of columns rather than shrinking text
  // past readability.
  const COLUMNS_PER_PAGE = 14;
  const pages: (typeof sortedEvents)[] = [];
  for (let i = 0; i < sortedEvents.length; i += COLUMNS_PER_PAGE) {
    pages.push(sortedEvents.slice(i, i + COLUMNS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  return renderToBuffer(
    <Document>
      {pages.map((pageEvents, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={s.page}>
          {pageIndex === 0 ? (
            centerLogoUrl ? <Image src={centerLogoUrl} style={s.logo} /> : <Text style={s.logoFallbackText}>{centerName}</Text>
          ) : null}
          <Text style={s.title}>Volunteer attendance register{pages.length > 1 ? ` (${pageIndex + 1}/${pages.length})` : ""}</Text>
          <Text style={s.subtitle}>{courseName}</Text>

          <View style={s.table}>
            <View style={s.tr}>
              <Text style={[s.th, { width: 130 }]}>Volunteer</Text>
              {pageEvents.map((e) => (
                <Text key={e.id} style={[s.th, { width: 42, textAlign: "center" }]}>
                  {formatDate(e.event_date)}
                </Text>
              ))}
              {pageIndex === pages.length - 1 ? <Text style={[s.th, { width: 50, textAlign: "center" }]}>Total</Text> : null}
            </View>
            {volunteers.length === 0 ? (
              <View style={s.tr}>
                <Text style={[s.td, { color: COLOR.muted }]}>No volunteer students registered.</Text>
              </View>
            ) : (
              volunteers.map((v) => {
                const totalAttended = events.filter((e) => attendedSet.has(`${v.id}:${e.id}`)).length;
                return (
                  <View key={v.id} style={s.tr}>
                    <Text style={[s.td, { width: 130 }]}>
                      {v.name}
                      {v.level ? ` (${v.level})` : ""}
                    </Text>
                    {pageEvents.map((e) => (
                      <Text key={e.id} style={[s.td, { width: 42, textAlign: "center" }]}>
                        {attendedSet.has(`${v.id}:${e.id}`) ? "✓" : "--"}
                      </Text>
                    ))}
                    {pageIndex === pages.length - 1 ? (
                      <Text style={[s.td, { width: 50, textAlign: "center" }]}>
                        {totalAttended}/{events.length}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </Page>
      ))}
    </Document>
  );
}
