# Handoff: Trainer Roster — design pass

## Overview
Design-only redesign of the trainer hub Roster tab (`/trainer/roster`) for MCT and ACT. Everything the shipped page does is kept: same actions, same data, same MCT-only settings. What changes is hierarchy, grouping and layout, so the first screenful is the candidates and the 18-column table becomes 7 core columns plus a toggleable progress strip. Implements the direction in `for-claude-code-roster-column-crowding.md` and matches the v4 hub vocabulary (`design_handoff_trainer_homepage_v4`).

**No functional change.** No data is removed, no server action is added or dropped. Do not add or delete features while building this.

## About the design files
`Trainer Roster Redesign.dc.html` is a **design reference built in HTML** — a prototype of intended look and behaviour, not production code. Recreate it in `ramysakr1-ux/celta-connect` (`src/app/trainer/(hub)/roster/*`) with the existing components (`page-head.tsx`, `avatar.tsx`, `trajectory-gradient-bar.tsx`, `trainer-hover`). Tweaks: `role` (MCT/ACT), `showDetailDefault`, `filmsTpSessions`.

## Fidelity
**High-fidelity** on layout, hierarchy, colour, type, copy and states. Sample data (12 candidates, tutors, consent) is illustrative — bind to the real roster query, tutors list and consent records. Sort, tone hashing and at-risk rules are the current ones.

## Screen: Roster (1440 design width, fluid ≥1200)

### Header (56px) — unchanged from v4
Connect mark + wordmark, tab row (Roster active: accent text 600 on 10% accent tint), role pill, course pill `C2/2026`, name, Settings. See v4 README for exact values.

### Page head
- Eyebrow 11.5px/700 uppercase, letter-spacing .1em, muted: `C2/2026 · Roster · click a row to open a portfolio`.
- Heading Newsreader 34px/600 ink-brown: `12 candidates` then ` · N at risk` in italic 500 accent-deep. Count = rows with at-risk reasons; omit the suffix when 0.
- Actions right, gap 8px, all 40px tall radius 8px, `white-space: nowrap`:
  - Export CSV — bordered white, hover 12% accent tint.
  - Email all candidates — same; keep the existing title tooltip ("Outside Connect — urgent only…").
  - Add candidate — **MCT only**, accent fill, white 13.5px/600, hover brightness 1.12.
- Removed from this row: Pre-course tasks, Observation tasks, Observation hours, Day-one activities, Share assessor link. These are navigation, not roster actions — they live under Teaching Practice / Assessor tab per the v4 plan. Nothing else moves.

### Controls row (between head and table)
- Left: **FOL pool by class** pill, 36px, gold tint bg `color-mix(gold 18%, card)`, gold border 45%, text gold-deep `oklch(40% 0.09 68)` 13px/600. Opens the existing FOL pool view (unchanged).
- Right: **Progress detail** switch, 32px pill, 26×14 track, 10px knob. Off: card bg, muted text "Show progress detail", grey track. On: 8% accent tint bg, ink text "Progress detail on", accent track, knob at 14px. Tooltip lists what it reveals. Client-side state only; persist in localStorage if trivial.

### Roster table — one card
Card: white, radius 14px, 1px border, shadow `0 1px 2px black/.04, 0 8px 24px ink-brown/.06` — the only shadowed card on the page.

**Grid** `300px repeat(6, 1fr) 96px 110px`, column gap 8px, horizontal padding 20px.

Header row: 10.5px/700 uppercase, letter-spacing .08em, muted, aligned to bottom, 1px border below. Columns in order: Candidate · Assessed hrs · TPs · Assignments · Criteria · Attendance · Provisional · At risk · Contact (right-aligned). All numeric columns centred, `font-variant-numeric: tabular-nums`.

Row: min-height 58px, padding 10px 20px, 1px border below `oklch(90% .012 82)`, background = candidate tone at 9% over card (existing tone hash). Whole row clickable → portfolio. Hover: `inset 0 0 0 1px accent, inset 4px 0 0 accent` (left accent bar + ring).

- **Candidate cell**: 36px avatar radius 10px (tone 30% bg, tone 55% ring, Newsreader 600 12.5px initials) + name 14px/600 + optional tag pill (10.5px/700, blue tint `oklch(93.5% .033 235)` / `oklch(42% .09 250)`; used for Extension etc.) + one sub-line 12px muted, ellipsised: `Stage 1 filed · N FOL entries` (or `Stage 1 not filed`).
- **Assessed hrs**: 2dp, 14px/500; warn colour `oklch(44% .095 68)` when < 4.
- **TPs**: `n` + `/8` in muted 400.
- **Assignments**: `n/2` + superscript `R` (9px, warn colour) when a resubmission is pending.
- **Criteria**: `n%`.
- **Attendance**: `n%`; red `oklch(52% .19 32)` and 700 when < 80.
- **Provisional**: text 13px; red 700 when the grade is slashed/at-risk.
- **At risk**: pill 11px/600, bg `oklch(94% .043 25)`, text `oklch(45% .15 27)`, 6px dot, label "At risk"; `title` = reasons joined with ` · `. Empty cell otherwise.
- **Contact**: right-aligned Email · Call links, 12.5px/500 teal `oklch(38% .072 195)`. Stop propagation so they don't open the portfolio.

**Withdrawn / frozen candidate**: row opacity .6, name cell as normal with sub `Left week N · record kept`, all seven data columns replaced by one centred grey pill (`oklch(93.5% .008 85)` / `oklch(44% .014 70)`) with the status label. Not clickable into detail.

**Sort**: at-risk rows first, then existing order (alphabetical).

### Progress detail strip (per row, when the switch is on)
Rendered inside the same row element beneath the main grid, so the row hover ring wraps both.

- Container: margin `0 20px 12px 68px` (left edge aligns with the name, past the avatar), padding 8px 4px, radius 8px, bg `black/.035`.
- Grid: 11 equal columns `repeat(11, minmax(0,1fr))`, each cell 40px tall, centred, 1px left hairline `black/.08` (none on first), padding 0 6px.
- Cell: label 9.5px/700 uppercase .08em muted, then value 12.5px/600 tabular, nowrap. Value is warn colour when behind (not filed, pending, fraction incomplete, FOL < 6).
- Order and source columns: TP stages · Supervised · Obs. hrs · Stage 1 · Stage 2/3 · CELTA 5 · FOL · **Standing** · Obs. tasks · Pre-course · Filmed obs.
- Shortened values so cells never wrap: `Cand. signed`, `2nd · pend.`, `Not yet`, `Not started`.
- **Standing** cell = existing trajectory gradient bar, fixed 44×5px, 10px marker (2px white ring, shadow), value text to its right. Tracks: Pass grades teal→grey→gold; At risk gold→red; Not yet assessed flat grey. Marker positions: Not yet 4%, At risk 18%, Pass 40%, Pass B 70%, Pass A 95%.

These 11 fields are exactly the columns removed from the flat table. Nothing is dropped.

### Filming consent card (only when the centre films TP)
White card radius 14px, padding 16px 24px, flex wrap. Left block: label `FILMING CONSENT` + `N of 12 handed in · Download blank form`. Right: one 28px pill per active candidate (first name, 6px dot). Signed: teal tint `oklch(93% .019 190)` / `oklch(32% .05 195)`. Not signed: transparent, dashed warn border, warn text. Click toggles the record (existing action); tooltip states the effect.

### Course settings (MCT only)
Section heading Newsreader 22px/600 + "Main course tutor only" 12.5px muted. Grid `1fr 360px`, gap 16px.

**Tutors card** (left)
- Title Newsreader 20px + hint "Invite by name, or hand off a role — including the MCT itself."
- Tutor rows: grid `1fr auto auto auto`, 10px vertical padding, 1px top divider. Avatar 36px + name 14px/600 (+ muted note e.g. "(second course)") + email 12px muted. Owned-assignment chips (10.5px/700, cream). Role select 30px bordered (Main course tutor / Assistant course tutor / TP tutor). Remove link red, 52px right-aligned; blank for the current MCT.
- Invite row: Name · Email inputs (36px), role select, accent **Invite** button.
- "Invited, not yet joined" list: name · email · role, Withdraw link.
- "Also at this centre": explainer line + bordered chips per assignable trainer with a cream **Add to course** button.

**Right column**
- **Delivery mode** card: segmented control in a cream tray (`padding 4px, radius 10px`), segments 32px radius 7px; selected = white with 1px shadow, ink; others muted. One-line note below changes with the mode.
- **Chat retention** card: two radios (Keep messages for `[1]` day / Keep until the course closes), Save button bottom-right.

All of these exist today; only their placement (grouped, below candidates) and card styling changes.

### ACT view
Same page minus Add candidate and the whole Course settings section. Accent gold.

## Design tokens
- Ink-brown (headings) `oklch(30% .042 58)` · Body `oklch(23.5% .017 65)` · Muted `oklch(51% .017 70)`
- MCT accent garnet `oklch(42% .13 27)`, deep `oklch(36% .12 27)` · ACT accent gold `oklch(60% .11 70)`, deep `oklch(50% .11 65)`
- Teal `oklch(38% .072 195)` · Warn `oklch(44% .095 68)` · Danger `oklch(52% .19 32)` · At-risk pill `oklch(94% .043 25)` / `oklch(45% .15 27)`
- Page `oklch(94.5% .012 85)` · Card `oklch(99.5% .004 90)` · Border `oklch(88% .014 82)` · Row divider `oklch(90% .012 82)`
- Fonts: Karla 400–700 (UI), Newsreader 500/600 (+ italic 500) headings, Instrument Serif italic wordmark.
- Radii: cards 14, rows/avatars 10, buttons 8, detail strip 8, pills 999.
- Avatar tone hash: existing 10-hue set at `oklch(45% .10 h)`.

## Interactions
- Row click → portfolio; Email/Call/At-risk pill do not propagate.
- Hover on everything clickable: rows (ring + left bar), buttons (tint), pills (inset accent ring), tabs (cream).
- Progress detail switch: client-side, instant, no layout shift in the core columns.
- Delivery mode segments and consent pills call the existing actions.
- Empty states: 0 at risk → no suffix in heading; no withdrawn → no frozen row; centre doesn't film → no consent card.

## Assets
None external. Logo mark is inline SVG. Fonts from Google Fonts.

## Files
- `Trainer Roster Redesign.dc.html` — the design (open in a browser; needs `support.js` beside it).
- `support.js` — runtime for the design file.
- `for-claude-code-roster-column-crowding.md` — the audit that motivated this pass.
