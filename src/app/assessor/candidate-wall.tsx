import Link from "next/link";
import type { CandidateCardData } from "@/lib/assessor-pack";

// design_handoff_assessor_landing_v2: the assessor's reading list. Cards
// grouped in Handbook order, each carrying one sentence on why this
// portfolio is on the list. Read-only throughout -- every card is a link
// into the portfolio and nothing here writes.

const BROWN = "oklch(30% 0.042 58)";
const RED = "oklch(45% 0.16 27)";
const AMBER = "oklch(44% 0.1 68)";
const GOLD = "oklch(60% 0.11 70)";
const PAPER = "oklch(99.2% 0.005 90)";

export type WallSectionId = "observe" | "fail" | "passA" | "centre" | "withdrawn";

export interface WallCandidate extends CandidateCardData {
  section: WallSectionId;
  /** One sentence on why this portfolio is on the assessor's list. */
  why: string;
}

// Only the first two sections carry a coloured top edge -- the design gives
// the rest none. An edge here means "there is a reason you are looking at
// this one", so putting one on every section would say nothing.
const SECTION_META: Record<WallSectionId, { heading: string; note: string; edge: string; headingColor?: string; muted?: boolean }> = {
  observe: { heading: "You will watch these teach", note: "", edge: BROWN },
  fail: { heading: "Fail or potential Fail", note: "read before anything else", edge: RED, headingColor: RED },
  passA: { heading: "Potential Pass A", note: "recommended", edge: "transparent" },
  centre: { heading: "The centre's selection", note: "", edge: "transparent" },
  withdrawn: { heading: "Withdrawn", note: "", edge: "transparent", muted: true },
};

export const SECTION_ORDER: WallSectionId[] = ["observe", "fail", "passA", "centre", "withdrawn"];

// The design's own GRADE table. Pass A gold, Pass B silver, a plain Pass
// deliberately neutral, Fail and Fail/Pass red. Withdrawn carries no fill at
// all -- it is not a grade.
function gradeStyle(label: string | null, withdrawn: boolean): React.CSSProperties {
  if (withdrawn) return { background: "transparent", color: "var(--color-muted)" };
  if (!label) return { background: "oklch(95% 0.008 85)", color: "var(--color-muted)" };
  if (/Fail/.test(label)) return { background: `color-mix(in oklab, ${RED} 14%, ${PAPER})`, color: RED };
  if (label === "Pass A") return { background: `color-mix(in oklab, ${GOLD} 20%, ${PAPER})`, color: "oklch(40% 0.09 68)" };
  if (label === "Pass B") return { background: "oklch(93% 0.012 85)", color: "oklch(40% 0.02 70)" };
  return { background: "oklch(95% 0.008 85)", color: "var(--color-muted)" };
}

/** One of the three completeness dots along the foot of a card. */
function Dot({ ok, label, title }: { ok: boolean; label: string; title: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px]" title={title} style={{ color: ok ? "var(--color-muted)" : AMBER }}>
      <span className="block size-[7px] rounded-full" style={{ background: ok ? "var(--color-ink)" : AMBER }} />
      {label}
    </span>
  );
}

function CandidateCard({ c }: { c: WallCandidate }) {
  const withdrawn = c.section === "withdrawn";
  // A withdrawn candidate's portfolio is bound to be incomplete, and it is
  // not the assessor's to chase -- the Handbook asks only for the letter and
  // the application (14.2 / 14.1). Appending "Stage 2 record still open"
  // there would read as a fault rather than the expected shape.
  const issue = withdrawn ? null : c.flaggedIssue;
  // An open issue outranks the section's own colour: the reason to read this
  // one has changed from "the Handbook says so" to "something is missing".
  const whyColor = issue ? AMBER : c.section === "fail" ? RED : c.section === "passA" ? AMBER : c.section === "observe" ? "var(--color-ink)" : "var(--color-muted)";

  return (
    <Link
      href={`/portfolio/${c.traineeId}`}
      className="flex flex-col gap-2.5 rounded-[6px] border border-border px-4 pt-3.5 pb-3 no-underline transition-colors duration-150 hover:border-[oklch(30%_0.042_58)]"
      style={{ background: PAPER, boxShadow: `inset 0 3px 0 ${SECTION_META[c.section].edge}`, opacity: withdrawn ? 0.7 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-[2px]">
          <span className="truncate font-serif text-[19px] leading-[1.1] font-semibold text-ink">{c.name}</span>
          {c.groupName ? <span className="truncate text-[11px] text-muted">{c.groupName}</span> : null}
        </span>
        <span
          className="inline-flex h-[22px] shrink-0 items-center rounded-full px-[9px] text-[10.5px] font-bold whitespace-nowrap"
          style={gradeStyle(c.provisionalLabel, withdrawn)}
        >
          {withdrawn ? "Withdrawn" : (c.provisionalLabel ?? "No grade yet")}
        </span>
      </div>

      <p className="min-h-[34px] text-[12px] leading-[1.45] text-pretty" style={{ color: whyColor }}>
        {c.why}
        {issue ? ` ${issue}.` : ""}
      </p>

      <div className="flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: "color-mix(in srgb, oklch(88% 0.016 82) 60%, transparent)" }}>
        <span className="flex items-center gap-2.5">
          <Dot ok={c.celta5Complete} label="CELTA 5" title={c.celta5Detail} />
          <Dot
            ok={c.tpsComplete}
            label="TPs"
            title={c.tpsComplete ? "All eight teaching practices taught" : `${c.tpsTaught} of 8 taught so far`}
          />
          <Dot
            ok={c.assignmentsComplete}
            label="Assign."
            title={c.assignmentsComplete ? "Every assignment marked" : "An assignment is still unresolved"}
          />
        </span>
        <span className="shrink-0 text-[10.5px] whitespace-nowrap text-muted tabular-nums">TP {c.tpsTaught}/8</span>
      </div>
    </Link>
  );
}

export function CandidateWall({
  candidates,
  observeHeading,
  observeNote,
  footLine,
  toggleLabel,
  toggleHref,
}: {
  candidates: WallCandidate[];
  observeHeading: string;
  observeNote: string;
  footLine: string;
  toggleLabel: string;
  toggleHref: string;
}) {
  return (
    <div className="flex flex-col gap-[22px]">
      {SECTION_ORDER.map((id) => {
        const inSection = candidates.filter((c) => c.section === id);
        if (inSection.length === 0) return null;
        const meta = SECTION_META[id];
        const note =
          id === "observe"
            ? observeNote
            : meta.note || `${inSection.length} candidate${inSection.length === 1 ? "" : "s"}`;
        return (
          <section key={id} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2
                className="font-serif text-[18px] font-semibold"
                style={{ color: meta.headingColor ?? (meta.muted ? "var(--color-muted)" : "var(--color-ink)") }}
              >
                {id === "observe" ? observeHeading : meta.heading}
              </h2>
              {note ? <span className="text-[12px] text-muted">{note}</span> : null}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {inSection.map((c) => (
                <CandidateCard key={c.traineeId} c={c} />
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-muted">
        <span className="text-pretty">{footLine}</span>
        <Link href={toggleHref} className="font-semibold whitespace-nowrap text-primary no-underline hover:underline">
          {toggleLabel}
        </Link>
      </div>
    </div>
  );
}
