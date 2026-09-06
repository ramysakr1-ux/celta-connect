# Handoff: Teaching Practice tab — v2, the feedback-owed queue

## Overview
Redesign of the trainer **Teaching Practice** tab (`/trainer/tp`). One sentence: the tab answers *"which lessons do I owe written feedback on."* Every taught lesson without the tutor's published feedback is a card; clicking it lands on that candidate's TP page with the feedback editor open. Under the cards, today's session as a timeline and tomorrow as one line. Lessons leave the page when feedback is saved.

Not a second roster (per person → Roster). Not the archive (→ portfolio). Not the points grid (→ Rotation). Same lesson data, opposite axis: per lesson, what is owed.

## About the design file
`Teaching Practice v2.dc.html` is a design reference in HTML, not production code. Open beside `support.js`. Rebuild in `ramysakr1-ux/celta-connect` on `tp-marking-queue.ts` and hub components. Tweaks: `role` (MCT / ACT — changes the accent colour and scope), `sameDayHours` (centre setting, default 24).

## Fidelity
High on layout, colour, type, copy, states, ordering. Names, points, times, note counts are sample data. Three owed cards shown; the grid wraps at three per row.

## Role colour
Per Roster v2 and Tutorials & Consultations: **MCT = garnet** `oklch(42% .13 27)` (deep `oklch(36% .12 27)`), **ACT = gold** `oklch(60% .11 70)` (deep `oklch(50% .11 65)`). The role colour carries: role pill, owed-card top edge and age pill, "Write feedback" / "Continue draft" button (deep shade, paper text), the Today eyebrow and timeline progress, link hovers, the Show/Hide toggle. **Late is always red** `oklch(45% .16 27)`. Candidate initials tiles are neutral (section tint, brown ink) so the role colour is the only accent.

## Page
Section card (page tint, radius 6, padding 24, gap 20).

**Header** — Newsreader 22px/600 "Teaching practice" + role pill (role colour bg; MCT paper text, ACT ink text) · Newsreader 28px/500 debt line with 4px left rule in role colour (red if anything is late): *"You owe written feedback on 3 lessons, 1 past the same-day rule."* / *"Nothing owed."* · 13px muted "Day 9 of 20 · TP4 · feedback is due the same day · lessons leave this page once feedback is saved." Right: outline links **Rotation & TP points →**, **Roster →** (34px; hover border = role colour).

**Owed cards** — grid `repeat(3, 1fr)`, gap 14. Oldest first. White, radius 6, 3px inset top edge (role colour; red when late), hover border same.
- Top block (padding 16/16/12): eyebrow 11px/700 uppercase `TP3 · MON 13` · age pill right (22px, 11px/700): `Just ended` / `2 h ago` on role-tint 16% with deep-shade ink; `2 days · past same-day` on red 12% with red ink. Then 40px neutral initials tile + Newsreader 20px/600 name + 11px group (`Group A · yours` / `Group B · Mert Kaya`). Then point 13px, aim chip 10px/700 (Grammar teal, Vocabulary amber, Functions violet `oklch(45% .10 300)`, Skills green `oklch(40% .08 150)`, 14% tint) + `Pre-Int (A2+) · slot 3 · 15:30`.
- **On your desk** block (role-tint bg 5–7%): eyebrow + right 10px "fills in by itself". Three rows, 16px square + 118px label + value:
  - *Your observation notes* — ink ✓ when live notes exist: `14 notes · 2b 2d 3a 5k`; empty square + red `None — write from film`.
  - *Self-evaluation* — ink ✓ `In · Mon 21:14`; empty + amber `Not yet · due 22:00 tonight`.
  - *Your draft* — role-tint 40% square when a draft exists: amber `2 points, 2 criteria tagged`; empty `Not started`.
  Nothing here is clickable; the squares are status, not checkboxes.
- Footer (padding 12/16/14): left 11px context — candidate standing if flagged (`NS at TP2 · at risk`), else `Everything is in` / `Can start now; release waits for the self-eval`. Right: 32px button in deep role colour: **Write feedback** or **Continue draft** (when a draft exists).
- Empty state: white card, Newsreader 20px italic muted "Nothing owed. Every taught lesson has your feedback."

**Other tutor line** (MCT only, when Group B has owed lessons): 12px muted "1 more owed by Mert Kaya (Group B)" + **Show / Hide** in role colour. Shown cards mix into the grid, sorted by age. ACT never sees other groups.

**Today card** — white, padding 16/18/18. Header: eyebrow `TODAY` (role colour) · 13px/600 "Wed 15 · TP4 · Group A · Pre-Intermediate (A2+) · Room 3" · right 12px muted "Observing: Priya, Deniz, Omar · peer task 2d · clear instructions · feedback session 16:30".
Timeline: 4 columns on a 2px track (border grey; progress to the live dot in role colour). Per stop: 16px dot (ink filled = taught, role colour = teaching now, hollow = next) · time 12px/700 (role colour when live) + 10px uppercase state (`taught` / `teaching now` / `next`) · name 13px/600 · point 12px muted · note 11px (`In the queue above` / `Self-eval due 22:00` / `Your notes: 6 so far · open sheet` in role colour / `Reveal peer notes after`). Fourth stop is the feedback session.
Footer row (top hairline): eyebrow `TOMORROW` · "Thu 16 · TP4 · Group B · Intermediate (B1) · Mert Kaya" · one inline item per slot: 6px dot (ink = plan in, amber = missing) + `14:00 Lucas Ferreira · plan in` / `15:30 Yuki Tanaka · no plan yet, due 09:00`. Right: "Same-day rule and slot lengths are centre settings."

## Rules
- **Owed** = `slot.end_at < now` and no published `tp_feedback` by the assigned tutor. Drafts stay owed (button reads Continue draft).
- Sort oldest slot end first. `past same-day` when age > `centre.feedback_same_day_hours`.
- Self-evaluation pending never blocks or hides a card.
- Drop-off on publish, not on candidate release or peer-note reveal.
- All "On your desk" state is derived: notes from the live observation sheet, self-eval from the candidate submission, draft from the feedback editor.
- Scope: ACT own group only; MCT own by default, other tutors behind Show.

## Tokens
Ink `oklch(23.5% .017 65)` · Muted `oklch(51% .017 70)` · Amber ink `oklch(44% .095 68)` · Red `oklch(45% .16 27)` · Page `oklch(92.5% .012 85)` · Section `oklch(96.4% .014 85)` · Card `oklch(99.2% .005 90)` · Border `oklch(88% .016 82)` · Garnet / Gold as above. Karla UI, Newsreader headings. Radii 6 (cards) · 11 (initials) · 999 (pills).

## Files
- `Teaching Practice v2.dc.html` — the design (needs `support.js`).
- `support.js` — runtime.
- `for-claude-code-tp-tab-v2.md` — build spec: queue definitions, page changes, out-of-scope list, open questions.
- `for-claude-code-rotation-page-grouping.md` — Rotation fix this tab links to (unchanged).
