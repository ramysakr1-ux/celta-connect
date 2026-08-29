import { Pulled } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";

// "To be completed on the final day of the course".
//
// Cambridge prints five tick-boxes for the candidate to tick by hand.
// Ramy's design checks each one against the record instead -- "Each item
// below is checked automatically against the pulled records — nothing to
// verify by hand" -- so a candidate cannot certify six hours of teaching
// practice that the system knows they haven't taught. A failed item shows
// its real figure next to it, which is what makes the check useful rather
// than merely restrictive.

export type FinalCheck = { label: string; met: boolean; detail?: string };

export function FinalDayChecks({ checks }: { checks: FinalCheck[] }) {
  return (
    <>
      <p className="flex items-center gap-2 text-[10px] text-muted" style={{ marginBottom: 12 }}>
        Each item below is checked automatically against the pulled records — nothing to verify by hand. <Pulled />
      </p>
      <div className="flex flex-col gap-2">
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-3 rounded-[8px] border px-3 py-2.5"
            style={{
              borderColor: c.met ? "oklch(83% 0.024 85)" : "oklch(80% 0.06 25)",
              background: c.met ? "oklch(97% 0.016 85)" : "oklch(96% 0.03 25)",
            }}
          >
            <span
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] text-[12px] font-bold text-white"
              style={{ background: c.met ? "var(--color-ink)" : "oklch(58% 0.17 25)" }}
              aria-hidden
            >
              {c.met ? "✓" : "!"}
            </span>
            <span className="text-[11px] text-ink">
              {c.label}
              {c.detail ? <span className="text-muted"> — {c.detail}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
