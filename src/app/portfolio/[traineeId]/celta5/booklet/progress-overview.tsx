import { Pulled } from "@/app/portfolio/[traineeId]/celta5/booklet/shell";

// "Progress overview" -- Ramy's own addition on top of the Cambridge
// document ("some good stats with the progress overview. That's very
// useful"), and the reason it carries an explicit "Not part of the official
// CELTA 5 text" line: an assessor should read it as a dashboard sitting
// above the record, never as an alteration to Cambridge's form.
//
// The figures colour by state -- short of requirement reads red, met reads
// green -- so a candidate sees where they stand without doing arithmetic.

type Card = {
  label: string;
  value: string;
  detail: string;
  state?: "met" | "short" | "neutral";
};

function stateColor(state: Card["state"]) {
  if (state === "met") return "oklch(45% 0.13 155)";
  if (state === "short") return "oklch(52% 0.17 25)";
  return "var(--color-ink)";
}

export function ProgressOverview({ cards }: { cards: Card[] }) {
  return (
    <>
      <p className="text-[10px] text-muted" style={{ marginBottom: 12 }}>
        Pulled automatically from Observations, TP Record, Written Assignments and the tutorial records. Not part of
        the official CELTA 5 text.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="c5-box">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-ink">{c.label}</span>
              <Pulled />
            </div>
            <p className="mt-1.5 text-[22px] font-bold leading-tight" style={{ color: stateColor(c.state) }}>
              {c.value}
            </p>
            <p className="mt-0.5 text-[10px] text-muted">{c.detail}</p>
          </div>
        ))}
      </div>
    </>
  );
}
