import { CERTIFICATE_HOURS_THRESHOLD } from "@/lib/volunteer-attendance";

interface VolunteerSession {
  id: string;
  name: string;
  today: { minutesAttended: number; ticked: boolean } | null;
  certificateHours: number;
}

// for-claude-code-trainer-remaining-screens.md's two Volunteers panels.
// "Hours toward certificates" is scoped to THIS course only -- volunteer_
// students has no field linking the same person across separate course
// enrollments (checked: no phone/email/external id, just name+course_id),
// so a real cross-course/cross-level running total would need a new
// volunteer-identity model first. Flagged, not guessed at.
export function VolunteerSessionPanels({ sessions }: { sessions: VolunteerSession[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-[6px] border border-border">
        <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Register — today&apos;s session
        </p>
        {sessions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No volunteers registered yet.</p>
        ) : (
          <div className="divide-y divide-border-faint">
            {sessions.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-ink">{v.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted">
                    {v.today ? `${v.today.minutesAttended} min` : "Not in today"}
                  </span>
                  <span className={`pill ${v.today?.ticked ? "pill-success" : "pill-neutral"}`}>
                    {v.today?.ticked ? "✓ Tick" : "No tick"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[6px] border border-border">
        <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Hours toward certificates
        </p>
        {sessions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No volunteers registered yet.</p>
        ) : (
          <div className="divide-y divide-border-faint">
            {sessions.map((v) => {
              const pct = Math.min(100, Math.round((v.certificateHours / CERTIFICATE_HOURS_THRESHOLD) * 100));
              return (
                <div key={v.id} className="flex flex-col gap-1 px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink">{v.name}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {v.certificateHours.toFixed(1)} / {CERTIFICATE_HOURS_THRESHOLD} hrs
                    </span>
                  </div>
                  <span className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
                    <span className="block h-1 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
