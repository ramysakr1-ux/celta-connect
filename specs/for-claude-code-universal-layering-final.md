# Universal layering system — final, replaces per-role backgrounds (supersedes prior color specs)

Written 23 Aug 2026, for Claude Code. Confirmed with the user against a live example
(`_layering_example.html`, matching `Pre-Course Task.dc.html`'s existing look). This is
the final decision: **one visual system everywhere**, not different backgrounds per role.
Supersedes `for-claude-code-role-tinted-backgrounds-v2-final.md` and
`for-claude-code-in-course-layered-frames-final.md` — apply this file's rule universally
(Centre Admin, Course Admin, inside the course for trainer/trainee/assessor, Command
Center, Volunteer/Student). No per-area color variation. Simpler, no confusion about which
area has which tint.

## The layering (outside → in), same everywhere
1. **Page background**: `oklch(92.5% 0.012 85)` — muted sand.
2. **Outer frame** (the panel/board holding a page's content): `oklch(96.4% 0.014 85)`,
   `1px solid oklch(88% 0.016 82)` border, `border-radius: 6px`.
3. **Inner cards** (sections, list panels, task blocks inside the outer frame):
   `oklch(93% 0.024 80)`, same border color/width.
4. **Innermost elements** (a text box inside a card, a highlighted row): back to
   `oklch(96.4% 0.014 85)` — alternating light/dark going deeper, which is what reads as
   layered depth instead of one flat wash.
5. **Callout/accent rows**: a light color-mixed tint of the relevant accent, e.g.
   `color-mix(in oklab, oklch(60% 0.11 70) 10%, oklch(93% 0.024 80))` for gold,
   `color-mix(in oklab, oklch(38% 0.072 195) 8%, oklch(93% 0.024 80))` for teal — never a
   flat accent fill.

## Hover / active states (part of this same system)
Clickable rows/tiles/tabs shift toward teal (`oklch(38% 0.072 195)`) on hover, and stay
teal (background tint + bold text) when active/current — implemented as a background-tint
change (`color-mix` teal into the card's own background level, ~10% hover / ~16% active),
not a full color swap. See `_layering_example.html` for the working reference (hover +
active row states).

## Reference files
`Pre-Course Task.dc.html` and `_layering_example.html` (both in this project) show the
exact working pattern — build from their literal token values.

## Colored top rule on every card
Every card (level 3 in the layering above) gets a `border-top: 3px solid` in a color from
the existing status-meaning palette — teal (`oklch(37.5% 0.058 195)`, positive/primary),
gold (`oklch(60% 0.11 70)`, flagged/system rule/needs attention), amber (existing warning
tone), red (existing blocking/error tone) — chosen per what that card represents, not
decorative. E.g. a Strengths card gets the teal rule, an Action Points card gets the gold
rule, matching `_layering_example.html`. No new colors — reuse the four that already carry
meaning elsewhere in the app.

Apply the colored top rule to every card everywhere, with no exception — including
Volunteer/Student. Only the background/layering values above (page/frame/card tones) skip
Volunteer/Student, which keeps its own current background treatment; its cards still get
the colored top rule like everywhere else.

## Do not
Do not vary background tint by role/area (Centre Admin, Course Admin, in-course,
Volunteer/Student, Command Center all use the identical five-level system above). Do not
use a single flat tone for page + card + inner content anywhere — that was the earlier
regression this replaces.

## Verify after
Check Centre Admin, Course Admin, a trainer/trainee/assessor screen inside a course,
Command Center, and Volunteer/Student — confirm every one shows the same sand → light
frame → darker card → light inner-box progression, and that hover/active rows turn teal
consistently across all of them.
