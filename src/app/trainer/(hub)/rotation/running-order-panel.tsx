import { rotationPosition } from "@/lib/rotation";
import { AIM_TYPE_LABELS, AIM_TYPE_STYLE, type AimType } from "@/lib/aim-type";
import { ReorderForm } from "@/app/trainer/(hub)/rotation/reorder-form";
import { AssignButton } from "@/app/trainer/(hub)/rotation/assign-button";
import { AimCoverageMatrix } from "@/app/trainer/(hub)/rotation/aim-coverage";

export interface RunningOrderMember {
  traineeId: string;
  fullName: string;
  baseSlot: number;
}

export interface RunningOrderPlan {
  traineeId: string;
  tpNumber: number;
  taughtAt: string | null;
  rotationPositionUsed: number;
  mainLessonAim: string | null;
  aimType: AimType | null;
}

// checkpoint 3 (Rotation.dc.html 1b) -- the half owning the next real TP
// day: who teaches in what order, whether their content is ready, and how
// fair the rotation has been so far.
export function RunningOrderPanel({
  halfLabel,
  members,
  nextDate,
  tpNumber,
  hasSchedule,
  allPlans,
  subgroupId,
}: {
  halfLabel: "A" | "B";
  members: RunningOrderMember[];
  nextDate: string;
  tpNumber: number;
  hasSchedule: boolean;
  /** This half's plan_assignments across every round (TP1-6), not just the next one -- the fairness check needs the full history. */
  allPlans: RunningOrderPlan[];
  subgroupId: string;
}) {
  const plansForNextRound = allPlans.filter((p) => p.tpNumber === tpNumber);
  const planByTrainee = new Map(plansForNextRound.map((p) => [p.traineeId, p]));
  const order = [...members].sort(
    (a, b) => rotationPosition(a.baseSlot, members.length, tpNumber) - rotationPosition(b.baseSlot, members.length, tpNumber)
  );

  return (
    <div className="flex flex-col gap-5">
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="flex flex-col gap-4">
        <div className="sheet flex flex-col gap-3.5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                {new Date(`${nextDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · half{" "}
                {halfLabel}
              </p>
              <h4 className="font-serif text-lg text-ink">Running order</h4>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold/16 px-3 py-1 text-xs font-semibold text-gold">
              <span className="size-1.5 rounded-full bg-current" />
              Next TP day
            </span>
          </div>

          <div className="flex flex-col">
            {order.map((m, i) => {
              const position = rotationPosition(m.baseSlot, members.length, tpNumber) + 1;
              const plan = planByTrainee.get(m.traineeId);
              const status = !hasSchedule
                ? { label: "No points", cls: "text-muted" }
                : !plan
                  ? { label: "Plan due", cls: "text-status-pending-text" }
                  : plan.taughtAt
                    ? { label: "Taught", cls: "text-ink font-semibold" }
                    : { label: "Plan in", cls: "text-ink font-semibold" };
              return (
                <div
                  key={m.traineeId}
                  className={`flex items-center gap-3.5 py-3 ${i > 0 ? "border-t border-border-faint" : ""}`}
                >
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-ink text-[13px] font-bold text-card">
                    {position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{m.fullName}</p>
                    {plan?.mainLessonAim ? <p className="truncate text-xs text-muted">{plan.mainLessonAim}</p> : null}
                  </div>
                  {plan?.aimType ? (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: AIM_TYPE_STYLE[plan.aimType].bg, color: AIM_TYPE_STYLE[plan.aimType].ink }}
                    >
                      {AIM_TYPE_LABELS[plan.aimType]}
                    </span>
                  ) : null}
                  <span className={`shrink-0 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                  {!plan && hasSchedule ? <AssignButton subgroupId={subgroupId} tpNumber={tpNumber} /> : null}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted">
            Positions come from the base order, rotated once for every day this half has taught.
          </p>
        </div>

        <div className="sheet flex flex-col gap-3 p-5">
          <h4 className="font-serif text-base text-ink">Base order — half {halfLabel}</h4>
          <p className="text-xs text-muted">
            Move a name and every later day recalculates. Days already taught keep the order they ran in.
          </p>
          <ReorderForm subgroupId={subgroupId} members={members.map((m) => ({ traineeId: m.traineeId, fullName: m.fullName, baseSlot: m.baseSlot }))} />
        </div>
      </div>

      <FairnessCheck members={members} allPlans={allPlans} />
    </div>

    <AimCoverageMatrix
      members={members.map((m) => ({ traineeId: m.traineeId, fullName: m.fullName }))}
      plans={allPlans.map((p) => ({ traineeId: p.traineeId, tpNumber: p.tpNumber, aimType: p.aimType }))}
    />
    </div>
  );
}

function FairnessCheck({ members, allPlans }: { members: RunningOrderMember[]; allPlans: RunningOrderPlan[] }) {
  // Keyed by trainee+round so each of the 6 rounds is looked up
  // independently -- a member can have some rounds already assigned
  // (frozen) and others still purely derived from the live base order.
  const planByTraineeAndTp = new Map(allPlans.map((p) => [`${p.traineeId}-${p.tpNumber}`, p]));
  const ordinal = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

  return (
    <div className="sheet flex flex-col gap-2.5 p-4">
      <p className="text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">Fairness check</p>
      <div className="flex flex-col">
        {members.map((m, i) => {
          const counts = new Array(members.length).fill(0);
          for (let tp = 1; tp <= 6; tp++) {
            // Frozen for rounds already assigned (matches "days already
            // taught keep the order they ran in"); live preview otherwise.
            const plan = planByTraineeAndTp.get(`${m.traineeId}-${tp}`);
            const position =
              plan && plan.rotationPositionUsed
                ? plan.rotationPositionUsed - 1
                : rotationPosition(m.baseSlot, members.length, tp);
            counts[position] += 1;
          }
          const spread = counts.map((c, p) => `${ordinal[p] ?? `${p + 1}th`} ×${c}`).join(" · ");
          return (
            <div key={m.traineeId} className={`flex items-center justify-between gap-3 py-1.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
              <span className="truncate text-xs text-ink">{m.fullName}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted">{spread}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-[1.5] text-muted">
        Turns don&apos;t always divide evenly across the six rounds — this shows who carries which position, rather than leaving it to be counted by eye.
      </p>
    </div>
  );
}
