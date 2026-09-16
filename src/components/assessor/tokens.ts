// The assessor's palette, in one place.
//
// for-claude-code-assessor-pack-complete.md B3: the pack and its five
// sub-pages each declared their own copy of the same five colours, and the
// copies had drifted -- two teals (37.5% 0.058 195 and 38% 0.072 195), two
// ambers (44% 0.1 68 and 44% 0.095 68) and two golds (63% 0.096 72 for the
// Pass A dot, 60% 0.11 70 for the header rule). One value each now:
//
//   TEAL  = --color-primary / HUB_TEAL. The assessor is not restyled by the
//           trainer hub's role colours (hub-accent.ts), so complete/met keeps
//           Connect's own teal rather than a hand-tuned variant of it.
//   AMBER = the attention colour. B1: amber means "needs the assessor's
//           attention", teal means complete, and a neutral document carries
//           no edge at all.
//   GOLD  = --color-gold. The identity colour: header rule, day bar, the
//           Pass A tint. The 63% variant is gone.
//
// Plain constants with no imports, so a client component can read them too
// (lib/hub-accent is `server-only`).
export const INK = "oklch(23.5% 0.017 65)";
export const MUTED = "oklch(51% 0.017 70)";
export const FAINT = "oklch(63% 0.012 82)";
export const BORDER = "oklch(88% 0.016 82)";
export const CARD = "var(--color-card)";
export const CREAM = "oklch(97% 0.008 88)";
/** The ink-brown of the pack header, the third role colour's dark half. */
export const WARM = "oklch(30% 0.042 58)";
export const TEAL = "oklch(37.5% 0.058 195)";
export const AMBER = "oklch(44% 0.1 68)";
export const GOLD = "oklch(60% 0.11 70)";

/**
 * Newsreader, the app's serif, named explicitly rather than trusted to the
 * bare family name: next/font loads it under a hashed family, so an inline
 * `fontFamily: "Newsreader, Georgia, serif"` was quietly rendering Georgia
 * on any machine without Newsreader installed.
 */
export const SERIF = "var(--font-newsreader), Newsreader, Georgia, serif";
