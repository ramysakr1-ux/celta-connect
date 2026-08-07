import { AIM_TYPES, AIM_TYPE_LABELS, AIM_TYPE_STYLE, aimTypeSpread, type AimType } from "@/lib/aim-type";

export interface CoverageMember {
  traineeId: string;
  fullName: string;
}

export interface CoveragePlan {
  traineeId: string;
  tpNumber: number;
  aimType: AimType | null;
}

// TP Points.dc.html 1b "Main aims so far" -- per candidate, how many times
// they've already been assigned each aim type across TP1-6 (TP7/8 are
// self-select, outside the library, and never carry an aim_type -- see
// checkpoint 4 plan). Coverage is per candidate, not per half, so a third
// grammar lesson is visible before it's assigned again.
export function AimCoverageMatrix({ members, plans }: { members: CoverageMember[]; plans: CoveragePlan[] }) {
  if (members.length === 0) return null;

  const plansByTrainee = new Map<string, CoveragePlan[]>();
  for (const p of plans) {
    if (p.tpNumber < 1 || p.tpNumber > 6) continue;
    const list = plansByTrainee.get(p.traineeId) ?? [];
    list.push(p);
    plansByTrainee.set(p.traineeId, list);
  }

  return (
    <div className="sheet flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="font-serif text-base text-ink">Main aims so far</h4>
        <p className="text-xs text-muted">Every candidate should meet a range of aims across their lessons</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-2 text-left text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">Candidate</th>
              {AIM_TYPES.map((t) => (
                <th key={t} className="p-2 text-center text-[10px] font-semibold tracking-[0.05em] text-muted uppercase">
                  {AIM_TYPE_LABELS[t]}
                </th>
              ))}
              <th className="p-2 text-right text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">Spread</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const taught = plansByTrainee.get(m.traineeId) ?? [];
              const countByType = new Map<AimType, number>();
              for (const p of taught) {
                if (!p.aimType) continue;
                countByType.set(p.aimType, (countByType.get(p.aimType) ?? 0) + 1);
              }
              const spread = aimTypeSpread(taught.map((p) => p.aimType));
              return (
                <tr key={m.traineeId} className="border-b border-border-faint last:border-b-0">
                  <td className="p-2 text-ink">{m.fullName}</td>
                  {AIM_TYPES.map((t) => {
                    const count = countByType.get(t) ?? 0;
                    return (
                      <td key={t} className="p-2 text-center">
                        {count > 0 ? (
                          <span className="inline-flex items-center justify-center gap-0.5">
                            {Array.from({ length: count }).map((_, i) => (
                              <span
                                key={i}
                                className="size-[7px] rounded-full"
                                style={{ background: AIM_TYPE_STYLE[t].dot }}
                              />
                            ))}
                          </span>
                        ) : (
                          <span className="inline-block h-px w-2.5 bg-border" />
                        )}
                      </td>
                    );
                  })}
                  <td className={`p-2 text-right text-xs font-semibold ${spread.distinct >= 3 ? "text-muted" : "text-gold"}`}>
                    {spread.distinct} of {spread.total} kinds
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
