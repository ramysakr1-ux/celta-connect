"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Command Center's four sections, as pills sitting between two coloured rules.
 *
 * Ramy designed this on 2 Sep 2026, replacing a dark bar with a sidebar under
 * it: "instead of one dark thing, just nice lines representing all the lines
 * that we have... and then we push the pills down, so we'll have three lines,
 * and the pills between the second and third."
 *
 * The sidebar is gone with it. It only ever held these four links and the
 * greeting, so once they came up here it listed everything twice -- his own
 * question: "if I have Overview, People, Money, Access on top, why do I need
 * the side panel with the same stuff?"
 *
 * Each section owns a colour, and its rule shows above AND below its pill, so
 * the colour reads as a column you are standing in rather than a decoration.
 */
export const CC_SECTIONS = [
  { label: "Overview", href: "/platform/command-center", colour: "oklch(62% 0.14 68)" },
  { label: "People", href: "/platform/command-center/people", colour: "oklch(45% 0.10 227)" },
  { label: "Money", href: "/platform/command-center/money", colour: "oklch(45% 0.10 111)" },
  { label: "Access", href: "/platform/command-center/access", colour: "oklch(44% 0.12 353)" },
] as const;

const SAND = "oklch(93.5% 0.012 82)";

function Rule({ activeHref }: { activeHref: string }) {
  return (
    <div style={{ display: "flex", height: 3 }}>
      {CC_SECTIONS.map((s) => (
        <span key={s.href} style={{ flex: "1 1 0", background: s.colour, opacity: s.href === activeHref ? 1 : 0.45 }} />
      ))}
    </div>
  );
}

export function SectionPills() {
  const pathname = usePathname() ?? "";
  // Longest match wins, so /people never resolves to the Overview root.
  const active =
    [...CC_SECTIONS].sort((a, b) => b.href.length - a.href.length).find((s) => pathname.startsWith(s.href))?.href ??
    CC_SECTIONS[0].href;

  return (
    <>
      <Rule activeHref={active} />
      <div style={{ background: SAND, padding: "11px 40px", display: "flex" }}>
        {CC_SECTIONS.map((s) => {
          const on = s.href === active;
          return (
            <div key={s.href} style={{ flex: "1 1 0", display: "flex", justifyContent: "center" }}>
              <Link
                href={s.href}
                style={{
                  fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                  padding: "6px 15px", borderRadius: 5, textDecoration: "none", whiteSpace: "nowrap",
                  border: `1px solid ${on ? s.colour : `color-mix(in oklab, ${s.colour} 40%, transparent)`}`,
                  color: on ? "oklch(99% 0.004 85)" : s.colour,
                  background: on ? s.colour : `color-mix(in oklab, ${s.colour} 9%, ${SAND})`,
                }}
              >
                {s.label}
              </Link>
            </div>
          );
        })}
      </div>
      <Rule activeHref={active} />
    </>
  );
}
