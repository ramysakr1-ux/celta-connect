# Trainer homepage — "Today" tab

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Trainer Walkthrough.dc.html`, screen `1a`.

This is where a trainer lands after login — the `Today` tab, first of seven in the trainer nav (`Today, Roster, Timetable, Volunteers, Teaching Practice, Resource hub, Grades Report`).

## Header (56px, present on every trainer screen)

- Left: Connect mark (32×32 tile, gold+cream interlocking Cs) + "Connect" wordmark, italic serif, gold.
- Center: the 7 nav tabs. Active tab (`Today`): teal text, teal 2px underline. Inactive: muted grey-brown text, no underline.
- Right: course code pill ("C2/2024", teal fill), trainer's name (muted text), and — **only if the account has `hub_access`** — a Connect Hub icon button (26×26, hollow, subtle border). Other tutors on the same course never see this icon.

## Page body

**Eyebrow + heading row:**
- Eyebrow (uppercase, small, muted): course + date range + week number, e.g. "ITI Istanbul C2/2024 · 6 Nov – 1 Dec · week 2 of 4"
- Heading (serif, large): today's date, e.g. "Tuesday 14 November"
- Right-aligned actions: a secondary button ("Post announcement") and a primary teal button ("Write TP feedback")

**Three-column panel grid** (ratio 1.15fr : 1fr : 1.05fr). Each panel carries a 3px top accent border and a matching uppercase label color, so the three are visually distinct at a glance:

1. **Today's schedule** (teal accent) — chronological list of the day's timetable events pulled straight from the timetable, each row showing time + title. A live TP session gets a bold row, a colored left rule, and a "Live" pill (teal fill, white text). Non-TP rows (prep, feedback, phonology, PPP) get muted or teal left rules with no pill.

2. **Needs you** (gold accent — signals a system-flagged rule, not routine content) — up to a handful of bold action items that need the trainer's attention today: unsent TP feedback (names + date taught), assignments due today (submitted count), attendance below threshold (shown in red with the percentage and hours). Empty when nothing needs attention — don't force filler.

3. **Cohort** (brown/ink accent) — one row per candidate: a small colored initials avatar (each candidate gets a distinct hue), name, and status sourced from the unified Roster Standing table's TP-lesson-stages rollup ("on track" / "behind"), not a bespoke count. A candidate flagged behind is shown in amber, matching Roster's color for the same metric — not red. Panel footer links to the full Roster.

## Design tokens used
Ink `oklch(30% 0.042 58)`, body text `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (action) `oklch(37.5% 0.058 195)`, gold (system rule) `oklch(63% 0.096 72)`, red (alert) `oklch(45% 0.15 27)`, amber (warning / behind-on-stages, matches Roster) `oklch(44% 0.095 68)`, border `oklch(89.5% 0.012 82)`, card bg `oklch(99.5% 0.004 90)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings), Instrument Serif italic (wordmark only).

Cohort avatar hues (one per candidate, for visual variety — not semantic): blue `oklch(52% 0.1 260)`, terracotta `oklch(55% 0.11 25)`, green `oklch(58% 0.1 145)`, purple `oklch(60% 0.1 300)`, gold `oklch(63% 0.096 72)`; a candidate flagged red uses the alert red instead of a hue.

## Notes
- This is one of several trainer screens documented in `Trainer Walkthrough.dc.html` (Roster, Timetable, Teaching Practice, Rotation, Grades Report, Volunteers, Resource hub, Portfolio, Announcements) — build against the full file for the rest of the trainer app, not just Today.
- If your current build's trainer homepage differs from this (different panels, different data, different layout), treat this spec as the source of truth and rebuild to match — this file is the one Ramy signed off on.
