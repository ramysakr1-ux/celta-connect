import "server-only";
import path from "node:path";
import { Font, StyleSheet } from "@react-pdf/renderer";

// Shared by the course-level close-out PDFs (grades report, attendance
// register, tutor list, timetable-as-taught, observations log) added
// together for this feature -- same visual identity as the existing
// per-candidate generators (withdrawal-letter-pdf, celta5-booklet-pdf,
// etc.) but factored once since these five are new siblings, not
// duplicated from an existing single-consumer pattern.
const fontsDir = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Newsreader", src: path.join(fontsDir, "Newsreader.ttf") });
Font.register({ family: "Karla", src: path.join(fontsDir, "Karla.ttf") });

export const COLOR = {
  ink: "#2a2723",
  muted: "#7c7368",
  border: "#e2ded5",
  teal: "#1c4e52",
  gold: "#a97a2f",
  cream: "#f8f3e8",
};

export const closeOutPdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Karla", fontSize: 9, color: COLOR.ink, backgroundColor: "#ffffff" },
  logo: { width: 48, objectFit: "contain", marginBottom: 14 },
  logoFallbackText: { fontFamily: "Newsreader", fontSize: 14, color: COLOR.ink, marginBottom: 14 },
  title: { fontFamily: "Newsreader", fontSize: 16, color: COLOR.ink, marginBottom: 4 },
  subtitle: { fontSize: 9.5, color: COLOR.muted, marginBottom: 16 },
  table: { display: "flex", flexDirection: "column", width: "100%" },
  tr: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: COLOR.border },
  th: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLOR.muted, padding: 5 },
  td: { fontSize: 8.5, color: COLOR.ink, padding: 5 },
  sectionTitle: { fontFamily: "Newsreader", fontSize: 12, color: COLOR.ink, marginTop: 16, marginBottom: 6 },
});

export function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
