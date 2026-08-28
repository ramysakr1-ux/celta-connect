# Pre-course task, scavenger hunt & GTKY pick — spec for Claude Code

Written 27 Aug 2026. Covers the three trainee screens that exist before day one, all under the "Pre-course task" tab.

## Sequence
1. **Acceptance email** — sent on enrollment, contains: (a) the pre-course task questions (5 sections, mapped to the 5 CELTA units, ~4 hours, done on paper — not graded, not submitted, tutor reads the paper copy on day one), and (b) the "Find your way around Connect" scavenger hunt (6 questions about locating things in the platform).
2. **Friday-before email** (sent the Friday immediately preceding the Monday start) — tells the trainee the answer key to the pre-course task is now live in Connect, and that groups/GTKY activity are ready to view.
3. **Course starts Monday** — trainee arrives at their normal "Today" landing page; the pre-course tab remains accessible as a record but is no longer the active flow.

## Screen 1 — `1a0` Pre-course task (initial state, ~9 days out)
Two side-by-side panels under one "Welcome to Connect" heading:
- **Pre-course task** panel: progress bar + fraction ("2 of 5 sections done"), current section name, estimated time, primary CTA "Continue," secondary "Read the brief."
- **Find your way around** panel: progress bar + fraction ("2 of 6 found"), a checklist of 6 location questions. Each question self-resolves to "Found" the moment the trainee actually navigates to the correct place in the product — this is not a form to fill in, it's an instrumented tour. No manual "mark as found" button.

Both panels are gated: answer keys and full solutions are NOT visible yet. This screen only shows progress state.

## Screen 2 — `1a0f` Pre-course task, Friday before (~3 days out)
Same tab, later state:
- **Pre-course task** panel flips to accent/complete styling once all 5 sections are done: "Answer key — open now" becomes the big CTA. Answer key opens to the whole cohort on the Friday date regardless of individual completion time — nobody is gated on anyone else finishing first.
- **Find your way around** panel shows all 6 rows as "Done."

## Screen 3 — `1a0g` Day-one GTKY activity pick
Separate panel, appears once trainee groups are finalized (same Friday-before window): three getting-to-know-you activities to choose from (a mixer, a guessing game, a paired-interview game), each ~20 minutes, for the Monday afternoon slot after the demo lesson. Trainee picks one; if no pick is made, the tutor picks for the group. Unassessed, tutor not in the room.

## Data model notes
- Pre-course task completion is section-level (5 sections), tracked per trainee.
- Scavenger hunt items are boolean flags per trainee, set by instrumented navigation events (visiting the real destination), not a self-report checkbox.
- Answer key visibility is a single cohort-wide unlock date (the Friday before start), not per-trainee.
- GTKY activity pick is per-group, not per-trainee — one selection represents the whole teaching group.

## Design tokens
Ink `oklch(30% 0.042 58)`, muted `oklch(51% 0.017 70)`, teal (task/action) `oklch(37.5% 0.058 195)`, gold (scavenger hunt) `oklch(63% 0.096 72)`, card `oklch(99.5% 0.004 90)`, border `oklch(89.5% 0.012 82)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings), Instrument Serif italic (wordmark).

## Files
- `Pre-Course Task Screens.dc.html` — the three screens, design source.
