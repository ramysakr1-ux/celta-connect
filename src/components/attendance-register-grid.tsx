function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

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
  events: { id: string; event_date: string }[];
  volunteers: { id: string; name: string }[];
  attendance: { volunteer_student_id: string; timetable_event_id: string }[];
}) {
  const attendedSet = new Set(attendance.map((a) => `${a.volunteer_student_id}:${a.timetable_event_id}`));

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
            {events.map((e) => (
              <th key={e.id} className="w-[52px] px-0.5 py-2.5 text-center text-[10px] font-semibold text-muted">
                {formatShortDate(e.event_date)}
              </th>
            ))}
            <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Total</th>
          </tr>
        </thead>
        <tbody>
          {volunteers.map((v) => {
            const attendedCount = events.filter((e) => attendedSet.has(`${v.id}:${e.id}`)).length;
            return (
              <tr key={v.id} className="border-b border-border-faint last:border-none">
                <td className="px-4 py-2.5 text-ink">{v.name}</td>
                {events.map((e) => {
                  const present = attendedSet.has(`${v.id}:${e.id}`);
                  return (
                    <td key={e.id} className="px-0.5 py-2.5 text-center">
                      <span
                        title={present ? "Attended" : "Not marked present"}
                        className={`inline-flex h-[22px] w-[30px] items-center justify-center rounded-[5px] text-xs font-medium ${
                          present ? "status-pill status-pill-on-track" : "border border-dashed border-border-faint text-muted"
                        }`}
                      >
                        {present ? "✓" : "--"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-center text-xs font-medium text-muted">
                  {attendedCount} of {events.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
