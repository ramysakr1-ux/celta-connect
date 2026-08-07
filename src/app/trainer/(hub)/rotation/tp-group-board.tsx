import { rotationPosition, distinctTpDates, type TpTimetableEvent } from "@/lib/rotation";

export interface BoardMember {
  traineeId: string;
  fullName: string;
  baseSlot: number;
}

export interface BoardHalf {
  subgroupId: string;
  halfOrder: 1 | 2;
  members: BoardMember[];
}

export interface PlanLookup {
  taughtAt: string | null;
}

// checkpoint 3 (Rotation.dc.html 1a) -- one board per TP group: a row per
// half, a column per real TP-type timetable date (course-wide, chronological
// -- not per abstract TP-number). A cell is only filled in the owning
// half's row; the other half's row is blank for that date, per the
// reference's own legend ("Blank means the other half is teaching").
export function TpGroupBoard({
  groupName,
  halves,
  tpEvents,
  plansByKey,
  today,
}: {
  groupName: string;
  halves: BoardHalf[];
  tpEvents: TpTimetableEvent[];
  plansByKey: Map<string, PlanLookup>;
  today: string;
}) {
  const allDates = distinctTpDates(tpEvents);
  const nextDate = allDates.find((d) => d >= today) ?? null;

  if (allDates.length === 0) {
    return (
      <div className="sheet flex flex-col gap-2 p-6">
        <h3 className="font-serif text-lg text-ink">{groupName}</h3>
        <p className="text-sm text-muted">
          No TP days scheduled yet -- add some on the{" "}
          <a href="/trainer/timetable" className="text-primary">
            Timetable
          </a>{" "}
          page.
        </p>
      </div>
    );
  }

  return (
    <div className="sheet flex flex-col gap-4 p-6">
      <div>
        <h3 className="font-serif text-lg text-ink">{groupName}</h3>
        <p className="text-sm text-muted">Halves alternate which real TP day they teach on.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-40 shrink-0 border-b border-border p-2 text-left text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">
                Candidate
              </th>
              {allDates.map((date, i) => {
                const owningHalf = i % 2 === 0 ? 1 : 2;
                const isNext = date === nextDate;
                return (
                  <th
                    key={date}
                    className={`min-w-[64px] border-b border-l border-border-faint p-1.5 text-left ${
                      isNext ? "bg-gold/10" : ""
                    }`}
                  >
                    <span className={`block text-[10px] font-semibold ${isNext ? "text-gold" : "text-ink"}`}>
                      {new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Half {owningHalf === 1 ? "A" : "B"}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {halves.map((half) => (
              <tr key={half.subgroupId}>
                <td className="border-b border-border-faint p-2 align-top">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3.5 w-[3px] shrink-0 rounded-full ${half.halfOrder === 1 ? "bg-primary" : "bg-[oklch(45%_0.1_300)]"}`}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
                      Half {half.halfOrder === 1 ? "A" : "B"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-col gap-2.5">
                    {half.members.map((m) => (
                      <p key={m.traineeId} className="text-sm text-ink">
                        {m.fullName}
                      </p>
                    ))}
                  </div>
                </td>
                {allDates.map((date, i) => {
                  const owningHalfOrder: 1 | 2 = i % 2 === 0 ? 1 : 2;
                  const owns = owningHalfOrder === half.halfOrder;
                  const halfDateIndex = Math.floor(i / 2);
                  const tpNumber = halfDateIndex + 1;
                  const inRotationSystem = tpNumber <= 6;
                  return (
                    <td key={date} className="border-b border-l border-border-faint p-1.5 align-top">
                      {owns ? (
                        <div className="flex flex-col gap-2.5">
                          {half.members.map((m) => {
                            if (!inRotationSystem) {
                              return <div key={m.traineeId} className="h-[22px]" />;
                            }
                            const plan = plansByKey.get(`${m.traineeId}-${tpNumber}`);
                            const position = rotationPosition(m.baseSlot, half.members.length, tpNumber) + 1;
                            const taught = Boolean(plan?.taughtAt);
                            const isNextCol = date === nextDate;
                            const chipClass = taught
                              ? "bg-ink text-card"
                              : isNextCol
                                ? "bg-gold text-gold-foreground"
                                : "bg-surface-muted text-muted";
                            return (
                              <div key={m.traineeId} className="flex flex-col items-center gap-0.5">
                                <span className={`flex size-[22px] items-center justify-center rounded-[6px] text-xs font-bold ${chipClass}`}>
                                  {position}
                                </span>
                                <span className={`text-[9px] font-semibold ${isNextCol ? "text-gold" : "text-muted"}`}>
                                  TP{tpNumber}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] bg-ink" />
          <span className="text-[11px] text-muted">Taught</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] bg-gold" />
          <span className="text-[11px] text-muted">Next TP day</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] bg-surface-muted" />
          <span className="text-[11px] text-muted">Scheduled</span>
        </div>
        <span className="text-[11px] text-muted">
          Number in the cell is the teaching position that day. Blank means the other half is teaching.
        </span>
      </div>
    </div>
  );
}
