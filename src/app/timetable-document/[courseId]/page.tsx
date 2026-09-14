import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { buildDayRows, categorize, resolveTimeBands, type TimetableEvent } from "@/lib/timetable-grid";
import { toDisplayCategory, type DisplayCategory } from "@/lib/timetable-category-style";
import { formatCalendarDate } from "@/lib/format-date";
import { PrintButton } from "@/app/timetable-document/[courseId]/print-button";

export const dynamic = "force-dynamic";

// The printed timetable. Ramy, 14 Sep 2026: "give the tutor the calendar
// link and a print view."
//
// Deliberately OUTSIDE the trainer hub, for the same reason /tp-document is
// outside /portfolio: the hub's layout wraps every page in the rail, the
// header and the chat dock, a child cannot remove a layout, and all of it
// would print around the timetable. So this is its own top-level route
// carrying its own access check.
//
// It is the whole course at once -- the board on screen is one week at a
// time, and a printed week is not what anyone pins to a wall.

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(45% 0.017 70)";
const BORDER = "oklch(78% 0.016 82)";
const FAINT = "oklch(88% 0.012 83)";
const TEAL = "oklch(37.5% 0.058 195)";
const GOLD = "oklch(52% 0.1 70)";

// Colour is not the thing on paper -- a lot of centres print in black and
// white -- so each category also carries a word.
const CATEGORY: Record<DisplayCategory, { rule: string; label: string }> = {
  wg: { rule: TEAL, label: "Whole group" },
  rm: { rule: INK, label: "Group room" },
  iw: { rule: MUTED, label: "Individual" },
  admin: { rule: GOLD, label: "Deadline" },
  lu: { rule: FAINT, label: "Break" },
};

export default async function TimetableDocumentPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  const allowed = viewer
    ? (viewer.role === "trainer" || viewer.role === "admin" || viewer.role === "trainee") && viewer.course_id === courseId
    : assessorCourseId === courseId;
  if (!allowed) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const [{ data: course }, { data: events }] = await Promise.all([
    supabase.from("courses").select("name, start_date, end_date, center_id, time_bands").eq("id", courseId).maybeSingle(),
    supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", courseId)
      .order("event_date")
      .order("event_time"),
  ]);
  if (!course) notFound();

  const centre = course.center_id ? await getCachedCenter(course.center_id) : null;
  const timeBands = resolveTimeBands(course.time_bands);
  const rows = buildDayRows((events ?? []) as TimetableEvent[], timeBands);

  const weeks: { label: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    if (row.weekLabel || weeks.length === 0) weeks.push({ label: row.weekLabel ?? "", rows: [] });
    weeks[weeks.length - 1].rows.push(row);
  }

  const span = [course.start_date, course.end_date]
    .filter(Boolean)
    .map((d) => formatCalendarDate(d as string, { day: "numeric", month: "long", year: "numeric" }))
    .join(" – ");

  const cell = (list: TimetableEvent[]) =>
    list.length === 0 ? null : (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {list.map((event) => {
          const cat = toDisplayCategory(categorize(event));
          return (
            <div key={event.id} style={{ borderLeft: `2.5pt solid ${CATEGORY[cat].rule}`, paddingLeft: 4 }} className="keep">
              <p style={{ margin: 0, fontSize: "7.5pt", lineHeight: 1.25, color: INK, fontWeight: cat === "lu" ? 400 : 600 }}>{event.title}</p>
              {event.detail ? (
                <p style={{ margin: 0, fontSize: "6.5pt", lineHeight: 1.25, color: MUTED }}>{event.detail}</p>
              ) : null}
              {event.event_time ? (
                <p style={{ margin: 0, fontSize: "6.5pt", lineHeight: 1.25, color: MUTED }}>{event.event_time.slice(0, 5)}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    );

  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 0.5in; }
        @media print {
          .doc-chrome { display: none !important; }
          .doc-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
          .week-break { break-before: page; }
        }
        .keep { break-inside: avoid; }
        .tt th, .tt td { border: 0.5pt solid ${FAINT}; vertical-align: top; padding: 3pt 4pt; }
        .tt th { background: oklch(96.5% 0.008 85); font-size: 6.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; font-weight: 700; }
      `}</style>

      <div style={{ background: "oklch(97.5% 0.008 88)", minHeight: "100vh", color: INK }}>
        <div
          className="doc-chrome"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px" }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: MUTED }}>
              Timetable
            </p>
            <p style={{ margin: 0, fontSize: 18 }}>{course.name}</p>
          </div>
          <PrintButton />
        </div>

        <div
          className="doc-sheet"
          style={{ margin: "0 auto 40px", maxWidth: 1180, background: "white", padding: 28, boxShadow: "0 8px 30px oklch(23.5% 0.017 65 / 0.08)" }}
        >
          <header style={{ borderBottom: `1.5pt solid ${INK}`, paddingBottom: 8, marginBottom: 14 }}>
            <h1 style={{ margin: 0, fontSize: "14pt", letterSpacing: "-0.01em" }}>{course.name}</h1>
            <p style={{ margin: "2pt 0 0", fontSize: "8pt", color: MUTED }}>
              {[centre?.name, span].filter(Boolean).join(" · ")}
            </p>
          </header>

          {weeks.map((week, weekIndex) => (
            <section key={week.label || weekIndex} className={weekIndex > 0 ? "week-break" : undefined} style={{ marginBottom: 18 }}>
              {week.label ? (
                <p style={{ margin: "0 0 5pt", fontSize: "8.5pt", fontWeight: 700, color: INK }}>{week.label}</p>
              ) : null}
              <table className="tt" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ width: "6%" }}>Day</th>
                    <th style={{ width: "11%" }}>Admin &amp; deadlines</th>
                    {timeBands.map((band) => (
                      <th key={band.label}>{band.label.replace(/\s*[–-]\s*/, " – ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {week.rows.map((row) => (
                    <tr key={row.isoDate}>
                      <td>
                        <p style={{ margin: 0, fontSize: "9pt", fontWeight: 700 }}>{row.date.split(" ")[1]}</p>
                        <p style={{ margin: 0, fontSize: "6.5pt", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED }}>
                          {row.weekday}
                        </p>
                      </td>
                      <td>{cell(row.admin)}</td>
                      {row.bands.map((bandEvents, i) => (
                        <td key={i}>{cell(bandEvents)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          <footer style={{ borderTop: `0.5pt solid ${FAINT}`, paddingTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
            {(Object.keys(CATEGORY) as DisplayCategory[]).map((cat) => (
              <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "6.5pt", color: MUTED }}>
                <span style={{ display: "inline-block", width: 7, height: 7, background: CATEGORY[cat].rule }} />
                {CATEGORY[cat].label}
              </span>
            ))}
            <span style={{ marginLeft: "auto", fontSize: "6.5pt", color: MUTED }}>
              Printed from Connect · the timetable on screen is the live one
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}
