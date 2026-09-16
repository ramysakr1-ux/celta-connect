import { INK, MUTED, SERIF } from "@/components/assessor/tokens";

// for-claude-code-assessor-pack-complete.md B4: the pack and the candidate
// portfolio landing each had a component called `Figure`, at the same size,
// with labels that disagreed (11/700/0.1em against 10/600/0.05em). One now.
// The `of` half -- "3 of 8" -- is the landing's, and stays optional because
// the pack's four figures carry their denominator inside the value string.
export function Figure({
  label,
  value,
  of,
  ink,
}: {
  label: string;
  value: string;
  of?: string;
  /** TEAL when the figure is met, AMBER when it still needs attention. */
  ink?: string;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: "var(--text-micro)", fontWeight: 600, letterSpacing: "0.05em",
          textTransform: "uppercase", color: MUTED,
        }}
      >
        {label}
      </p>
      {/* The type scale's own table gives KPI figures h1, tabular -- the same
          size Command Center, the platform accounts screen and the owner's
          stat cards already use. This one sat at h2, the section-head size,
          which is what the mechanical mapping off Tailwind's 20px step
          produced. Ramy, 16 Sep 2026. */}
      <p
        style={{
          fontFamily: SERIF, fontSize: "var(--text-h1)", lineHeight: 1.05, fontWeight: 600,
          fontVariantNumeric: "tabular-nums", color: ink ?? INK, marginTop: 5,
        }}
      >
        {value}
        {/* A real space, not just the margin: without it a screen reader says
            "4of 8". */}
        {of ? <span style={{ fontSize: "var(--text-meta)", color: MUTED, marginLeft: 6 }}> {of}</span> : null}
      </p>
    </div>
  );
}

/** The four figures of a head, spaced as one row. */
export function FigureRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 34 }}>{children}</div>;
}
