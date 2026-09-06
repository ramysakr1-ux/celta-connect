# Handoff: Trainer Roster v2 — glanceable roster

## Overview
Second design pass on the trainer hub Roster tab (`/trainer/roster`), MCT and ACT. Builds on v1 (`README-v1-baseline.md`, kept here for everything v2 does not change). v2 replaces the numeric table cells with visual encodings (segments, tinted pills, bars, tiles), adds a four-tile summary strip, and turns the At-risk column into a multi-flag column. **Logic and data are unchanged** — same roster query, same at-risk rules, same actions, same MCT-only settings. Do not add or remove features.

## About the design files
`Trainer Roster Redesign v2.dc.html` is a **design reference built in HTML**, not production code. Recreate in `ramysakr1-ux/celta-connect` (`src/app/trainer/(hub)/roster/*`) using the existing components (`page-head.tsx`, `avatar.tsx`, `trajectory-gradient-bar.tsx`). Open beside `support.js`. Tweaks: `role` (MCT/ACT), `showDetailDefault`, `filmsTpSessions`.

## Fidelity
High on layout, colour, type, copy, thresholds and states. Sample data illustrative.

## What is unchanged from v1 (see baseline README)
Header, page head + actions, controls row (FOL pool pill, progress-detail switch), card shell, row hover, candidate cell, withdrawn row, sort, progress-detail strip, filming consent card, Course settings section, ACT view, tokens, fonts, radii.

## New: summary strip
Directly under the page head, above the controls row. Grid `repeat(4, 1fr)`, gap 12px. Each tile: padding 14px 18px, radius 12px, 1px border, shadow `0 1px 2px black/.04`, flex row gap 14px: number Newsreader 30px/600 tabular + label 13px/700 + sub 11.5px muted. Hover: inset 1px accent ring. Click filters the table to that set (client-side; clicking again clears).

| Tile | Count | bg | border | ink | sub |
|---|---|---|---|---|---|
| At risk | rows with ≥1 at-risk reason | `oklch(94% .043 25)` | `oklch(85% .06 25)` | `oklch(45% .15 27)` | attendance, hours or criteria |
| Resubmissions | rows with a pending resubmission | `oklch(93% .05 80)` | `oklch(84% .08 78)` | `oklch(40% .09 68)` | assignments to re-mark |
| On track | active rows with no reason | `oklch(93% .019 190)` | `oklch(84% .04 190)` | `oklch(32% .05 195)` | of N active candidates |
| Pass A / B | provisional A or B | card | border | ink-brown | provisional, week N |

Counts exclude withdrawn candidates.

## Table grid (changed)
`290px 150px 130px 110px 150px 110px 130px 1fr 90px`, column gap 8px, padding 10px 20px, row min-height 58px. Header labels (10.5px/700 uppercase, left-aligned, Contact right): Candidate · TPs taught · of 8 · Assessed hrs · Assignments · Criteria met · Attendance · Provisional · Flags · Contact.

## Cell encodings (changed)
Colour scale used throughout: **teal = good** `bg oklch(93% .019 190)` / `ink oklch(32% .05 195)`; **gold = watch** `bg oklch(93% .05 80)` / `ink oklch(40% .09 68)`; **red = problem** `bg oklch(94% .043 25)` / `ink oklch(45% .15 27)`. Pills are 26px tall, radius 999, padding 0 10px, 12.5px/700 tabular, width fit-content.

- **TPs taught** — 8 segments 10×16px radius 3px, gap 3px, then the count 12.5px/600. Taught segments 1–4 teal `oklch(45% .07 195)`, 5–8 gold `oklch(63% .096 72)`; untaught `black/.08`.
- **Assessed hrs** — pill "4.50 of 6" ("of 6" 500 weight, 75% opacity). Teal when ≥ 4h, gold when < 4h.
- **Assignments** — two 26px tiles "A1" "A2", radius 7px, 11px/700, 1.5px border. Passed: teal bg, no border. Resubmission pending (next unsubmitted, when a resub is flagged): gold bg, dashed warn border. Not submitted: transparent, border `oklch(80% .014 82)`, muted ink. Tooltip states the state in words.
- **Criteria met** — 8px track `black/.07` radius 999 filling the cell + `n%` 12.5px/600 right-aligned in 34px. Fill colour: < 60 red `oklch(52% .19 32)`, 60–74 gold `oklch(63% .096 72)`, ≥ 75 teal `oklch(45% .07 195)`.
- **Attendance** — pill with 6px leading dot. ≥ 90 teal, 80–89 gold, < 80 red.
- **Provisional** — pill 12px/700, letter-spacing .02em, padding 0 12px. Pass A: solid gold fill `oklch(63% .096 72)` with dark ink `oklch(24% .06 55)` (contrast-safe). Pass B: `oklch(90% .05 75)` / `oklch(38% .09 65)`. Pass: teal pill. Slashed/at-risk grade: red pill with `line-through`.
- **Flags** — wrapping row of pills 11px/600, padding 3px 9px, 6px dot, gap 4px. Order: **At risk** (red; title = reasons joined ` · `) → **Resubmission** (gold) → **Stage 1 unfiled** (blue `oklch(93.5% .033 235)` / `oklch(42% .09 250)`). Empty when none.
- **Contact** — unchanged (Email · Call).

Withdrawn row: the seven data columns collapse into one centred grey status pill, as in v1.

## Thresholds (single source of truth)
Hours warn < 4 · Attendance red < 80, gold < 90 · Criteria red < 60, gold < 75 · TPs colour break after 4. These must match the existing at-risk rules in the codebase; if they differ, the codebase wins and the palette mapping stays.

## Interactions
- Summary tile click filters rows; active tile gets the inset accent ring persistently.
- Row click → portfolio. Pills, tiles, Contact links stop propagation. Tooltips on tiles, pills, flags.
- Progress-detail switch, consent pills, delivery-mode segments as v1.

## Tokens (additions to v1)
Teal good `oklch(93% .019 190)` / `oklch(32% .05 195)` · Teal bar `oklch(45% .07 195)` · Gold watch `oklch(93% .05 80)` / `oklch(40% .09 68)` · Gold bar `oklch(63% .096 72)` · Pass A ink `oklch(24% .06 55)` · Pass B `oklch(90% .05 75)` / `oklch(38% .09 65)` · Blue flag `oklch(93.5% .033 235)` / `oklch(42% .09 250)` · Segment/track empty `black/.08` and `black/.07`.

## Files
- `Trainer Roster Redesign v2.dc.html` — the design (needs `support.js` beside it).
- `support.js` — runtime.
- `README-v1-baseline.md` — v1 spec; all unchanged parts are defined there.
- `for-claude-code-roster-column-crowding.md` — original audit.
