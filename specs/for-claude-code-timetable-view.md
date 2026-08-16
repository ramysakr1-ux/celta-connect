# Read-only Timetable View — spec for Claude Code

Written 15 Aug 2026, for Claude Code. File: `Timetable View.dc.html`. Read-only view of the real 4-week course grid (`Timetable Refresh.dc.html` is the editable/admin source; this is the trainee/trainer-facing display, same underlying data).

## Layout, top to bottom

1. **Header row** — "Connect · Timetable" eyebrow + week-range title (e.g. "Week 1 · 6 – 10 November") on the left. On the right: a name chip (avatar initials circle + "Name · Group XYZ") and an "Everything" / "Mine" pill toggle.
2. **Live-now status bar** — full-width teal bar, shown only when a session is currently live or about to open. Contains: pulsing gold dot, "LIVE NOW" label, session title, time range + "opened HH:MM", and a gold "Join" pill on the right. Hidden entirely when nothing is live.
3. **Legend row** — right-aligned, small color-swatch + label pairs explaining what each card color means (see Color system below).
4. **The grid** — sits on a soft diagonal gradient card (teal → sand → gold, all at low opacity, 14px radius) representing the "glass on a surface" concept. Columns: day-number gutter (64px) + admin column (150px) + 9 time-band columns (min 118px each). Rows = the days of the selected week.
5. **Week picker** — 4 pill buttons ("Week 1" … "Week 4"), centered, below the grid.
6. **Footnote** — one line explaining read-only + "Mine" behavior.

## Day gutter (left column per row)

- Large serif day number (Newsreader, 19px), small uppercase day-of-week label below it.
- "TODAY" label in teal, shown only on the current day.
- Today's row gets a 3px teal left border on the gutter cell; other rows have no rule (transparent).

## Session cards (the core visual unit)

Each populated cell renders a **glass card**, not a flat block:
- `border-radius: 10px`
- `backdrop-filter: blur(10px)`
- `border: 1px solid oklch(100% 0 0 / 0.75)` (crystal edge highlight)
- `border-top: 2.5px solid <category accent color>` (this is what carries the color meaning)
- `box-shadow: 0 6px 18px oklch(23.5% 0.017 65 / 0.07), inset 0 1px 0 oklch(100% 0 0 / 0.8)`
- Interior fill is a category-tinted gradient (see table below) — not plain white; the tint is part of how color communicates meaning.
- Content: title (11.5px, weight varies by category), optional meta line (10px, muted), optional camera-link icon, optional gold "You teach" tag (only visible in "Mine" mode).
- Empty cells render nothing (no card, no border) — just blank space in the grid.

## Color system — every color is meaningful, shown in the legend

| Category | Meaning | Accent (top border) | Card interior tint | Title weight |
|---|---|---|---|---|
| `wg` | Whole-group input session — Zoom | Teal `oklch(38% 0.072 195)` | Teal-tinted glass `oklch(95.5% 0.03 195 / 0.75→0.35)` | 500 |
| `rm` | Group-room session — TP, feedback, planning, tutorials | Ink `oklch(23.5% 0.017 65)` | Near-white glass, high opacity `oklch(100% 0 0 / 0.92→0.55)` (the most "solid" card — TP is the anchor activity) | 600 |
| `admin` | Admin & deadlines | Gold `oklch(60% 0.11 70)` | Gold-tinted glass `oklch(96% 0.045 80 / 0.75→0.35)` | 500 |
| `iw` | Individual / bookable (consultations, own-time writing, Stage 3) | Muted brown `oklch(51% 0.017 70)` | Neutral sand glass `oklch(96% 0.008 85 / 0.6→0.25)` | 500 |
| `lu` | Lunch | transparent | Faint neutral `oklch(96% 0.008 85 / 0.35→0.15)`, no top-border accent | 400 |

Legend row shows these 5 swatches with their plain-English labels (e.g. "Group room — TP, feedback, planning").

## "Mine" filter

- Toggle between "Everything" (all cards full-strength) and "Mine" (cards not involving the signed-in person fade to `opacity: 0.25`, 160ms transition).
- Involvement logic: TP slots use a letter code (A–F); the viewer's own letter is "mine" + tagged "You teach"; other letters within their group are "mine"; letters outside their group are not. Sessions marked for one group only (title or meta contains "· ABC" with no "DEF" mention, or vice versa) are "mine" only for that group. Everything else (whole-cohort sessions) is "mine" for everyone.
- The gold "You teach" tag only appears in "Mine" mode, on the viewer's own personal TP slot.

## Camera-link icon (join/navigate)

- Every session card except `lu` (lunch) and `admin` (deadlines) gets a small circular icon button (22px), bottom-left of the card, camera glyph (rounded rect body + triangular lens, `stroke-width 1.8`, `viewBox 0 0 24 24`, paths: `M23 7l-7 5 7 5V7z` + `rect x=1 y=5 width=15 height=14 rx=2.5`).
- **Dormant state** (more than 10 minutes before session start): icon shown at low-opacity teal (`oklch(38% 0.072 195 / 0.1)` bg, `/ 0.6` ink), `cursor: default`, not clickable (`pointer-events: none`), tooltip "Opens 10 minutes before the session".
- **Active state** (within 10 minutes of start through end, i.e. "live"): solid teal bg, white icon, `cursor: pointer`, clickable, tooltip "Join now" — but only for sessions the viewer is actually part of (their own TP/observation group). If live but not their session, icon stays visible (so they can see something's happening) but is not clickable, tooltip "Not your session".
- Destination varies by session type: whole-group sessions → Zoom link; TP/observation-room sessions → that specific room; feedback/tutorials/consultations → their respective links. (Exact URLs/routes are a backend concern — this spec defines the interaction rule, not the destination data.)

## Typography & tokens (shared with rest of app)

- Fonts: Karla (body/UI), Newsherwer serif (day numbers, page title) — same as other Connect screens.
- Base ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, page background `oklch(92.5% 0.012 85)`.
- All styling inline; no external stylesheet.

## Data source

Full real 4-week grid (20 working days, 9 time bands/day + 1 admin column), reused verbatim from `Timetable Refresh.dc.html`'s week structures — this view does not invent new session content, only re-presents it read-only with the glass/color treatment above.
