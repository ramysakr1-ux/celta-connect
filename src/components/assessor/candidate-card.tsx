import Link from "next/link";
import type { CandidateCardData } from "@/lib/assessor-pack";
import { Dot } from "@/components/assessor/panel";
import { AMBER, BORDER, CARD, INK, MUTED, TEAL } from "@/components/assessor/tokens";

// Verbatim from Assessor Visit.dc.html's own GRADE table. These are not
// decoration: Pass A is gold, Pass B is silver, a plain Pass is deliberately
// NEUTRAL, and Fail is red. The previous mapping used the app's generic pill
// classes and coloured a plain Pass green -- which read as "good" on a grade
// that is simply a pass, and left Pass B and Pass looking alike.
//
// Teal in this design means complete/met as a STATUS (a met dot, hours
// logged), never a grade. Keeping the two apart is the point.
const GOLD_TINT = "color-mix(in oklab, oklch(60% 0.11 70) 18%, var(--color-card))";
const SILVER_TINT = "color-mix(in oklab, oklch(65% 0.008 90) 30%, var(--color-card))";
const RED_TINT = "color-mix(in oklab, oklch(45% 0.16 27) 14%, var(--color-card))";

export const GRADE: Record<string, { bg: string; ink: string }> = {
  "Pass A": { bg: GOLD_TINT, ink: "oklch(40% 0.09 68)" },
  "Pass B": { bg: SILVER_TINT, ink: "oklch(42% 0.01 90)" },
  Pass: { bg: "oklch(94% 0.012 85)", ink: "oklch(51% 0.017 70)" },
  Fail: { bg: RED_TINT, ink: "oklch(45% 0.16 27)" },
};

// One candidate on the pack's wall.
//
// Ramy, 30 Aug 2026: "I think I want to cut the middleman... you don't need
// two gates." The card used to open a summary drawer whose own "Open the
// whole portfolio" was the only way through; the card is now that link.
//
// Left edge: amber when something is flagged, teal otherwise -- the pack's
// two meanings and no others (spec B1). Hover is the ring every other
// openable card in the app uses, not a fill (A3): a fill is for buttons.
export function CandidateCard({ c }: { c: CandidateCardData }) {
  const flagged = Boolean(c.flaggedIssue);
  return (
    <Link
      href={`/portfolio/${c.traineeId}`}
      className="card lift hover-ring no-underline"
      style={{
        background: flagged ? `color-mix(in oklab, ${AMBER} 8%, var(--color-card))` : CARD,
        border: `1px solid ${flagged ? `color-mix(in oklab, ${AMBER} 35%, transparent)` : BORDER}`,
        borderLeft: `3px solid ${flagged ? AMBER : TEAL}`,
        padding: "15px 16px", display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: "var(--text-body)", fontWeight: 600, color: INK }}>{c.name}</span>
        {c.provisionalLabel ? (
          <span
            style={{
              fontSize: "var(--text-micro)", fontWeight: 700, padding: "3px 9px", borderRadius: 99,
              background: (GRADE[c.provisionalLabel] ?? GRADE.Pass).bg,
              color: (GRADE[c.provisionalLabel] ?? GRADE.Pass).ink,
              flex: "none", whiteSpace: "nowrap",
            }}
          >
            {c.provisionalLabel}
          </span>
        ) : null}
      </div>
      <span style={{ fontSize: "var(--text-label)", color: MUTED }}>
        {c.tpsTaught}/8 TPs · {c.hoursAssessed.toFixed(1)} hrs{c.levels.length > 0 ? ` · ${c.levels.join(", ")}` : ""}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Dot ok={c.celta5Complete} label="CELTA 5" />
        <Dot ok={c.tpsComplete} label="TPs" />
        <Dot ok={c.assignmentsComplete} label="Assignments" />
      </div>
      {c.flaggedIssue ? (
        <span
          style={{
            fontSize: "var(--text-label)", lineHeight: 1.4, color: AMBER, borderRadius: 5, padding: "6px 9px",
            background: `color-mix(in oklab, ${AMBER} 10%, var(--color-card))`,
          }}
        >
          {c.flaggedIssue}
        </span>
      ) : null}
      {/* Handbook 11.6 puts the documenting duty on the assessor, so the
          assessor is told which candidate it applies to. Not amber: a failed
          written assignment with a Pass recommended is a legitimate outcome
          the assessor writes up, not something wrong with the pack. */}
      {c.assignmentFailNote ? (
        <span
          style={{
            fontSize: "var(--text-label)", lineHeight: 1.45, color: MUTED, borderRadius: 5, padding: "6px 9px",
            background: "var(--color-frame)", border: `1px solid ${BORDER}`,
          }}
        >
          {c.assignmentFailNote}
        </span>
      ) : null}
    </Link>
  );
}
