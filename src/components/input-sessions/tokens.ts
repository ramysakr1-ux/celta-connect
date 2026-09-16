// The input sessions' three local colours, in one place.
//
// Remainder pass A9 (16 Sep 2026): ten of the thirty-one session files each
// declared `const TEAL`, `const GOLD` and `const MUTED` with the same three
// literals -- the same problem the assessor pack had, where copies of one
// palette had quietly drifted apart. The other twenty-one sessions use the
// app's CSS variables directly and need nothing from here.
//
// Deliberately the values the sessions already shipped with, not a re-point:
// A9 asks for one definition, not a new palette.
export const TEAL = "oklch(38% 0.072 195)";
export const GOLD = "oklch(60% 0.11 70)";
export const MUTED = "oklch(51% 0.017 70)";
