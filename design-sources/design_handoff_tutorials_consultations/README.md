# Handoff: Tutorials and consultations — the section under the Timetable board

## Overview
Redesign of everything **below** the timetable board on `/trainer/timetable`. The board itself is untouched. The three stacked tutorial forms are replaced by one section: a **Tutorials** card (Stage 1 / 2 / 3 switcher), a **Consultation blocks** card, a **candidate grid** (one row per candidate, one cell per stage + consultations), and an **opened sheet** view. Logic follows the source mockup (`Tutorials-and-consultations-mockup.pdf`) exactly; this pass changes hierarchy, colour and layout only. **No new features, no removed data.**

## About the design files
`Tutorials and Consultations.dc.html` is a **design reference built in HTML**, not production code. Open it beside `support.js`. Recreate in `ramysakr1-ux/celta-connect` with the existing hub components (`page-head`, `avatar`, pills). Tweaks: `role` (MCT / ACT), `currentStage` (1 / 2 / 3 — which stage the Tutorials card opens on; in the app derive from course week).

## Fidelity
High on layout, colour, type, copy and states. Names, dates and counts are sample data.

## Roles (transparent system, view-only for others)
- **MCT** sees everything and can edit everything. Consultation blocks card shows a **per-tutor summary** (not individual blocks); clicking a tutor opens their blocks. No "Yours" markers.
- **ACT** sees all three groups and every tutor's blocks, but acts only on their own. Their own candidates carry a **Yours** tag in the grid; their own blocks and their own opened sheet are **accent-tinted with a "Yours" tag**; everything else is view-only (tooltips say "· view only").
- Accent: MCT garnet `oklch(42% .13 27)`, ACT gold `oklch(60% .11 70)` — the "Yours" tint always uses the current role's accent.

## Colour vocabulary (all pills 26px, radius 999, 12px/700, 6px leading dot)
| State | bg | ink | meaning |
|---|---|---|---|
| booked / confirmed | `oklch(93% .019 190)` | `oklch(32% .05 195)` | done by the candidate, nothing to do |
| waiting | `oklch(93% .05 80)` | `oklch(40% .09 68)` | waiting on the candidate |
| done | `oklch(93.5% .008 85)` | `oklch(38% .014 70)` | on the CELTA 5 |
| your move | transparent, 1.5px solid accent border | accent | tutor has to act (invite, place sheet) |
| nothing due | transparent, 1.5px dashed `oklch(85% .012 82)` | muted | — |

Card tints: **Tutorials** teal (`bg color-mix(teal-bar 7%, card)`, border `color-mix(teal-bar 30%)`, title ink `oklch(32% .05 195)`); **Consultation blocks** gold (`color-mix(gold-bar 10%, card)`, border 40%, title ink `oklch(40% .09 68)`). Teal bar `oklch(45% .07 195)`, gold bar `oklch(63% .096 72)`.

## Section head
Newsreader 28px/600 "Tutorials and consultations" + one explanatory line 13.5px muted (ends with the role scope note). Right: the legend as five pills (labels above).

## Card 1 — Tutorials (left, teal)
Header: eyebrow title `TUTORIALS` + sub (changes per stage) · **Stage 1 / 2 / 3 segmented control** (tray `black/.06` radius 8, segments 24px radius 6, selected white + shadow, each with a stage dot) · **Add sheet** button (accent, 30px) only on Stage 2.
Rows: grid `120px 1fr 150px`, 10px padding, hairline top.
- **Stage 1** — one summary row per group: avatar + group, "Invites sent …", pill "6 of 6 filed" (done) / "5 of 6 filed · 1 pending" (waiting). Invites happen from the grid cells.
- **Stage 2** — one sheet row per group: avatar + group, date/time/length, **segment bar** (one 6px segment per position; booked = teal if full else gold, empty `black/.09`), pill "n of N booked". Unplaced group: italic "No sheet placed yet" + accent-outline **Place sheet** button.
- **Stage 3** — flagged candidates only: "1 flagged · Priya Sharma" + **Invite** button; groups with nobody flagged show "Nobody flagged · nothing due" (grey).

## Card 2 — Consultation blocks (right, gold)
Header: `CONSULTATION BLOCKS` + sub + **Add block** (accent).
- **ACT view** — one row per block, whole course: tutor avatar + name, date/time/length, segment bar, "n of N booked" pill. The signed-in tutor's rows: accent 9% tint, 1.5px inset accent ring, small accent "YOURS" under the name.
- **MCT view** — one row per tutor: avatar + name, "N blocks this course", combined segment bar, "booked of total" pill. Click → that tutor's blocks (same row layout as ACT).
Sub copy: MCT "one line per tutor · click to open their blocks"; ACT "every tutor's blocks · yours highlighted · others view only".

## Candidate grid (shadowed card)
Card: white, radius 14, shadow `0 1px 2px black/.04, 0 8px 24px ink-brown/.06`. Grid `280px repeat(4, 1fr)`, gap 12px, padding 10px 20px, row min-height 66px, hairline dividers. Row bg = candidate tone at 7% (existing tone hash). Columns: Candidate · Stage 1 · Stage 2 · Stage 3 · Consultations.
- Candidate cell: 36px avatar radius 10 + name 14px/600 + "Group · Tutor" 12px muted (+ **Yours** tag for ACT's own candidates: 10px/700 uppercase, accent 14% bg, accent ink).
- Each stage cell: state pill (main text, e.g. "2nd · Mon 14 Sep 14:20", "Not booked", "Filed", "Flagged · invite", "—") over one 11.5px detail line (e.g. "Group A sheet", "sheet open, 2 positions left", "needs a Stage 3", "LRT submitted · own tutor only"). Detail line uses accent ink for **your move** cells.
- The **whole cell is the hit target**: hover shows accent 7% bg + 1px accent inset ring; click performs the mockup action (invite / open sheet / see booking). Tooltip = "main — detail".
- Sort: existing order (by group, then name).

## Opened sheet (bottom left)
Card title Newsreader 20px "Consultation sheet · Jordan Blake" (MCT) / "Your consultation sheet" + **Yours** pill (ACT); sub "Tue 15 Sep · 15:30 · four positions of 15 min · opened from the list above". Booked count pill top-right (gold when partial).
Rows grid `44px 56px 1fr auto`: ordinal (11px uppercase) · time (14px/600) · avatar + name, or dashed 28px square + italic "Open" · state pill (Booked teal / Open grey).
ACT-own: card bg accent 9%, 1.5px accent border. MCT: plain white card.
Footer line: "Same sheet as Stage 2: the candidate books the next open position, the sheet is the source of truth, nothing pings per booking."

## Bottom right
- **Booking rule** note (gold tint card): any tutor before an assignment's first submission; own tutor only after. Names the worked example.
- **Stays / Goes / New** card, three columns with a state pill each (grey / red / teal) — the migration summary from the mockup.

## Interactions
- Stage switcher: client-side; default from course week. Add sheet / Add block open the existing block form. Place sheet / Invite / cell clicks call existing actions.
- Hover: rows (accent 5% tint), cells (ring), pills (inset ring), buttons (brightness 1.12 / accent 10% tint).
- Empty states: no flagged → "Nobody flagged" rows; no blocks → card body shows a single muted line "No blocks yet".

## Tokens (shared with Roster v2 handoff)
Ink-brown `oklch(30% .042 58)` · Body `oklch(23.5% .017 65)` · Muted `oklch(51% .017 70)` · Page `oklch(94.5% .012 85)` · Card `oklch(99.5% .004 90)` · Border `oklch(88% .014 82)` · Divider `oklch(92% .01 82)` · Red `oklch(94% .043 25)` / `oklch(45% .15 27)`. Fonts Karla (UI), Newsreader (headings), Instrument Serif italic (wordmark). Radii: cards 14, avatars/rows 10, buttons 8, pills 999.

## Files
- `Tutorials and Consultations.dc.html` — the design (needs `support.js` beside it). Use the Tweaks to switch MCT/ACT and stage.
- `support.js` — runtime.
- `Tutorials-and-consultations-mockup.pdf` — the source logic mockup this design implements.
