interface VolunteerSession {
  id: string;
  name: string;
  today: { minutesAttended: number; ticked: boolean; tier: "absent" | "partial" | "present" } | null;
  certificateHours: number;
}

// for-claude-code-trainer-remaining-screens.md's two Volunteers panels.
// "Hours toward certificates" is scoped to THIS course only -- volunteer_
// students has no field linking the same person across separate course
// enrollments (checked: no phone/email/external id, just name+course_id),
// so a real cross-course/cross-level running total would need a new
// volunteer-identity model first. Flagged, not guessed at.
export function VolunteerSessionPanels({
  sessions,
  certificateHoursThreshold,
}: {
  sessions: VolunteerSession[];
  certificateHoursThreshold: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Register — today&apos;s session
        </p>
        {sessions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No volunteers registered yet.</p>
        ) : (
          <div className="divide-y divide-border-faint">
            {sessions.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[color-mix(in_oklab,var(--hub-hover-accent)_6%,transparent)]">
                <span className="text-sm text-ink">{v.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted">
                    {v.today ? `${v.today.minutesAttended} min` : "Not in today"}
                  </span>
                  <span
                    className={`pill ${v.today?.tier === "present" ? "pill-success" : v.today?.tier === "partial" ? "pill-warning" : "pill-neutral"}`}
                    title={v.today?.tier === "partial" ? "45-89 minutes -- recorded, but credits no hours toward the certificate" : undefined}
                  >
                    {v.today?.tier === "present" ? "✓ Tick" : v.today?.tier === "partial" ? "Partial" : "No tick"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Hours toward certificates
        </p>
        {sessions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No volunteers registered yet.</p>
        ) : (
          <div className="divide-y divide-border-faint">
            {sessions.map((v) => {
              const pct = Math.min(100, Math.round((v.certificateHours / certificateHoursThreshold) * 100));
              return (
                <div key={v.id} className="flex flex-col gap-1 px-4 py-2.5 transition-colors hover:bg-[color-mix(in_oklab,var(--hub-hover-accent)_6%,transparent)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink">{v.name}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {v.certificateHours.toFixed(1)} / {certificateHoursThreshold} hrs
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
