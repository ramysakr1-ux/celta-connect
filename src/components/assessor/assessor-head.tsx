import { INK, MUTED, SERIF } from "@/components/assessor/tokens";

// One head for every assessor screen.
//
// for-claude-code-assessor-pack-complete.md A1: the pack used Newsreader
// with an 11/700/0.1em eyebrow, its five sub-pages used `fontFamily:
// "Georgia, serif"` -- which, because globals.css already sets every h1-h6
// in Newsreader, was an inline override actively turning the serif off -- and
// the gate page used Tailwind's `font-serif`. Three fonts for one role.
//
// The spec says 26/600; the type scale that landed after it writes the h1
// size once (--text-h1, 28) and the eyebrow once (--text-label, 11.5), so
// the sizes come from the scale rather than being restated here. That is the
// one deliberate departure from A1's wording.
//
// The `.frame` belongs to the page, not to the head: the pack's frame also
// holds the Appian card, the requirements band and the candidate wall, while
// a sub-page's frame is the page. Every caller is already inside one.
export function AssessorHead({
  eyebrow,
  title,
  lede,
  actions,
}: {
  /** "Assessor access — read-only · lesson plans". Rendered uppercase. */
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** The pack's figures row. Sits right of the title on a wide screen. */
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "var(--text-label)", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: MUTED,
          }}
        >
          {eyebrow}
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: "var(--text-h1)", fontWeight: 600, color: INK, marginTop: 6 }}>
          {title}
        </h1>
        {lede ? (
          <p style={{ fontSize: "var(--text-meta)", color: MUTED, marginTop: 8, maxWidth: 720, lineHeight: 1.6 }}>
            {lede}
          </p>
        ) : null}
      </div>
      {actions ?? null}
    </div>
  );
}

/**
 * The sub-pages' section heading -- one document, one applicant, one
 * assignment. Newsreader like the h1 above it, at the scale's h3.
 */
export function AssessorSubHead({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 style={{ fontFamily: SERIF, fontSize: "var(--text-h3)", fontWeight: 600, color: INK, ...style }}>{children}</h2>
  );
}
