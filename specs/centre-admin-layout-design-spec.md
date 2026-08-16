# Centre Admin — layout & design spec (visual only, no build behavior)

Canvas width 1620px, padding 40px top / 56px sides / 60px bottom, column gap 26px between major sections. Page background `oklch(92.5% 0.012 85)` (warm cream).

## 1. Header row
Flex row, space-between, items centered.
- **Left cluster** (gap 14px): 32×32px rounded-8px dark tile (`oklch(23.5% 0.017 65)`) with a slowly spinning interlocking-Cs mark inside (gold `oklch(70% 0.12 72)` + cream `oklch(97% 0.008 88)` strokes) → "Connect" wordmark, italic Newsreader serif, 18px, ink color → 1px vertical divider (`oklch(88% 0.016 82)`, 18px tall) → **"Centre admin" pill**: uppercase, 11px, bold, letter-spacing 0.1em, teal text (`oklch(38% 0.072 195)`) on a pale teal-tinted background (teal at 10% mixed into card white), 1px teal border at 26% opacity, 4×10px padding, 5px radius.
- **Right**: trainer name, 13px, muted (`oklch(51% 0.017 70)`). Stays top-right as-is.

## 2. Tab bar
Directly under header, flex row gap 8px, bottom border 1px (`oklch(88% 0.016 82)`), 2px padding-bottom.
Three tabs: **Overview / Roles / Import** — plain text labels, active tab in ink/teal with a bottom rule matching the underline treatment used elsewhere on Connect; inactive tabs muted, no rule. Order and spacing fixed left-aligned under the header.

## 3. Roles panel (Roles tab)
Below a heading + subhead block (Newsreader serif 26px headline over a 13px muted paragraph, max-width 900px).
- **Role selector strip**: one card-backed row, 8px radius, 1px border, containing 4 equal-width segments side by side, each with a right divider (except last) and a 3px colored top "spine": **Centre administrator** (teal spine), **Centre manager** (gold spine), **Course administrator** (grey/muted spine), **Centre owner** (red spine). Each segment: role name bold 13.5px in its tone color, one-line description beneath. Clicking a segment selects it (visual selection state, not a route change).
- **Permission list** below the strip: rows of checkmark/✕ + short permission phrase + optional smaller muted note underneath, stacked vertically, one column.
- A tone-colored callout at the bottom of the panel states the cross-cutting rule for that role (e.g. the "reach stops at the centre boundary" line) — full-width band, tinted background matching the role's tone at low opacity, same tone-colored left content.

## 4. Import panel (Import tab)
Vertical stack, gap 16px. A step flow with a horizontal step tab row at top (Connect the sheet / Match the columns / See what happens / Afterwards) inside a bordered card (background `oklch(96.4% 0.014 85)`), each step's content panel below rendering one of: a column-mapping grid (4-column grid: source col / arrow / mapped-to / status), a stat tally row (large numbers + labels, color-coded by outcome: green=will import, gold=duplicates, red=missing data), or a plain list of point cards (bold title + description, left tone accent). Primary CTA button + a muted helper caption sit at the bottom of the panel, pinned via margin-top:auto.

## 5. Footer bar — Centre settings
Full-width card, `oklch(99.2% 0.005 90)` background, 1px border, 10px radius, 18×22px padding, flex row space-between, items centered.
- Left: two-line block — Newsreader serif 15px bold title "Centre settings" over an 11.5px muted line listing what's inside ("Centre profile, Google Drive connection, payment providers, admin roles").
- Right: **"Open settings →"** link, teal, no button chrome — sits at the bottom of the page, its own row below the tab content (Overview/Roles/Import), not inside any of the three panels.

## Color tokens (full palette used across the page)
- Ink (headings/primary text): `oklch(23.5% 0.017 65)`
- Muted (secondary text): `oklch(51% 0.017 70)`
- Teal — Centre administrator / primary actions / links: `oklch(38% 0.072 195)`
- Gold — Centre manager / warnings: `oklch(60% 0.11 70)`
- Red — Centre owner / alerts: `oklch(45% 0.16 27)`
- Green — positive/matched states: `oklch(48% 0.09 150)`
- Card background: `oklch(99.2% 0.005 90)`
- Border: `oklch(88% 0.016 82)`
- Page background: `oklch(92.5% 0.012 85)`
- Fonts: Karla (all UI text), Newsreader serif (headings/wordmark, italic for wordmark).
