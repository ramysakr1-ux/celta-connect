import "server-only";
import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import { COLOR, closeOutPdfStyles as s } from "./pdf-styles";

export interface TutorListInput {
  courseName: string;
  centerName: string;
  centerLogoUrl: string | null;
  tutors: { name: string; tutorRole: string | null }[];
}

export async function renderTutorListBuffer(input: TutorListInput): Promise<Buffer> {
  const { courseName, centerName, centerLogoUrl, tutors } = input;

  return renderToBuffer(
    <Document>
      <Page size="A4" style={s.page}>
        {centerLogoUrl ? <Image src={centerLogoUrl} style={s.logo} /> : <Text style={s.logoFallbackText}>{centerName}</Text>}
        <Text style={s.title}>Tutor list</Text>
        <Text style={s.subtitle}>{courseName}</Text>

        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { width: "60%" }]}>Name</Text>
            <Text style={[s.th, { width: "40%" }]}>Role</Text>
          </View>
          {tutors.length === 0 ? (
            <View style={s.tr}>
              <Text style={[s.td, { color: COLOR.muted }]}>No tutors recorded for this centre.</Text>
            </View>
          ) : (
            tutors.map((t, i) => (
              <View key={i} style={s.tr}>
                <Text style={[s.td, { width: "60%" }]}>{t.name}</Text>
                <Text style={[s.td, { width: "40%" }]}>{t.tutorRole ?? "Tutor"}</Text>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  );
}
