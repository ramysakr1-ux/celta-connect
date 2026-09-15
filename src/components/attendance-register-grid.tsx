// One shape for every date header, two lines, never wrapped -- Ramy,
// 5 Sep 2026: "the date keeps changing, vertical and then horizontal."
// (52px columns let "17 Aug" sit on one line and pushed "1 Sept" onto
// two.) Node's ICU also spells September "Sept"; the hub says "Sep".
import { classLessons } from "@/lib/volunteer-class-session";
import { blocksNeededForPresent } from "@/lib/volunteer-attendance";

function dateHeader(iso: string): { weekday: string; dayMonth: string } {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    dayMonth: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).replace("Sept", "Sep"),
  };
}

// A little colour on hover, not much (Ramy, 5 Sep 2026). --hub-hover-accent
// is set by the trainer hub; the assessor pack and the register-viewer
// page fall back to the teal.
const ROW_HOVER = "hover:bg-[color-mix(in_oklab,var(--hub-hover-accent,var(--color-primary))_6%,transparent)]";

// One column per teaching DAY, not per lesson. A session is a day (the
// tick rule is round(2N/3) of that day's N lessons), and a two-group
// course teaches six lessons a day across two levels -- so a per-lesson
// grid repeated every date six times, gave every volunteer three columns
// for a class they are not in, and totalled "12 of 96" (walked 15 Sep
// 2026). Each cell is that volunteer's own class that day.
//
// Checkpoint 9 (Assessor pack) -- the one new deliverable build-spec.md
// names for this checkpoint: a real, per-session volunteer attendance
// register, not just a name list or a bare count. Shared across three call
// sites (trainer's /volunteers, the register-viewer token page, and the
// assessor's read-only pack) so the actual grid is built once. Pure
// presentational -- pre-fetched rows in, no queries of its own.
export function AttendanceRegisterGrid({
  events,
  volunteers,
  attendance,
}: {
  events: { id: string; event_date: string; detail?: string | null }[];
  volunteers: { id: string; name: string; level?: string | null }[];
  attendance: { volunteer_student_id: string; timetable_event_id: string }[];
}) {
  const attendedSet = new Set(attendance.map((a) => `${a.volunteer_student_id}:${a.timetable_event_id}`));
  const dates = [...new Set(events.map((e) => e.event_date))].sort();

  if (volunteers.length === 0) {
    return <p className="p-4 text-sm text-muted">No volunteer students registered yet.</p>;
  }
  if (events.length === 0) {
    return <p className="p-4 text-sm text-muted">No TP sessions scheduled yet -- attendance has nothing to log against.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[6px] border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Volunteer</th>
            {dates.map((date) => (
              <th key={date} className="w-[56px] px-0.5 py-2 text-center align-bottom text-[10px] leading-[1.25] font-semibold whitespace-nowrap text-muted">
                <span className="block text-[9px] font-bold tracking-[0.08em] uppercase">{dateHeader(date).weekday}</span>
                <span className="block">{dateHeader(date).dayMonth}</span>
              </th>
            ))}
            <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {volunteers.map((v) => {
            const mine = classLessons(events, v.level);
            const days = dates.map((date) => {
              const lessons = mine.filter((e) => e.event_date === date);
              const attended = lessons.filter((e) => attendedSet.has(`${v.id}:${e.id}`)).length;
              const present = lessons.length > 0 && attended >= blocksNeededForPresent(lessons.length);
              return { date, lessons: lessons.length, attended, present };
            });
            const heldDays = days.filter((d) => d.lessons > 0).length;
            const attendedCount = days.filter((d) => d.present).length;
            return (
              <tr key={v.id} className={`border-b border-border-faint transition-colors last:border-none ${ROW_HOVER}`}>
                <td className="px-4 py-2.5 text-ink">
                  {v.name}
                  {v.level ? <span className="ml-2 text-xs text-muted">{v.level}</span> : null}
                </td>
                {days.map((d) => (
                  <td key={d.date} className="px-0.5 py-2.5 text-center">
                    {d.lessons === 0 ? (
                      <span title="Their class did not run this day" className="text-xs text-muted">&nbsp;</span>
                    ) : (
                      <span
                        title={
                          d.present
                            ? `Present -- ${d.attended} of ${d.lessons} lessons`
                            : d.attended > 0
                              ? `One lesson only -- ${d.attended} of ${d.lessons}, banks nothing`
                              : "Not marked present"
                        }
                        className={`inline-flex h-[22px] w-[30px] items-center justify-center rounded-[5px] text-xs font-medium transition-shadow hover:shadow-[inset_0_0_0_1px_var(--hub-hover-accent,var(--color-primary))] ${
                          d.present
                            ? "status-pill status-pill-on-track"
                            : d.attended > 0
                              ? "status-pill status-pill-pending"
                              : "border border-dashed border-border-faint text-muted"
                        }`}
                      >
                        {d.present ? "✓" : d.attended > 0 ? String(d.attended) : "--"}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-center text-xs font-medium text-muted">
                  {attendedCount} of {heldDays}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
