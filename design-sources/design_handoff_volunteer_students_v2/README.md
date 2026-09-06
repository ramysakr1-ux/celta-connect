# Handoff: Volunteer students — trainer tab, v2

## Overview
Redesign of the **Volunteers** tab on the trainer side (`/trainer/volunteers`, today the register + copy-link + remove list). One page with three parts: a **Today strip** (RSVP replies and Zoom presence for today's TP session), the **register grouped by class** (12-class strip + hours banked + link state per student), and the **student card** beside the list (hours toward certificate, this course's marks, link, boundaries). Replaces `Volunteer Register.dc.html` (v1) which split register and card into two screens.

Nothing on this page is typed in by the trainer except adding a student and re-issuing a link. Attendance comes from the timetable's Zoom logging (`for-claude-code-zoom-auto-attendance.md`); replies come from the day-before RSVP (`for-claude-code-volunteer-rsvp.md`, `for-claude-code-volunteer-messaging-complete.md`).

## About the design files
`Volunteer Students v2.dc.html` is a **design reference built in HTML**, not production code. Open it beside `support.js`. Recreate in `ramysakr1-ux/celta-connect` with existing hub components. Tweaks: `role` (MCT / ACT), `showToday` (hide the strip on non-TP days), `lessonsPerSession` (2 or 3 — stands in for the centre setting; drives the "n of N lessons" rule text and hours per class).

## Fidelity
High on layout, colour, type, copy, states and the hours arithmetic. Names, dates, hours and marks are sample data. Two classes × 3 students; the real page will hold 6–8 per class.

## The attendance model (from build-spec.md — do not reinvent)
- A TP session is **N × 45-min lessons** (default 3 = 135 min). Presence = Zoom join-to-leave time **summed across rejoins**. No camera rule for volunteers.
- **Present**: ≥ ⌈2N/3⌉ lessons (2 of 3, or 1 of 2 on a two-lesson day) → banks the **whole session** (2¼ h at N=3, 1½ h at N=2).
- **One lesson**: 45–89 min → recorded as its own mark, **banks nothing**.
- **Absent**: < 45 min.
- **Certificate at 160 h**, cumulative **across courses and levels, held against the person** (`volunteer_person_id`), milestones 40 / 80 / 120.
- Threshold, session length, milestones and target are **centre settings**; never hardcode.
- Face-to-face sessions: tutor ticks the register directly, same hours follow.
- The **volunteer** sees a plain class count and their hours — no percentage, no threshold, no "can miss n more". The trainer page may show more, but there is no eligibility threshold anywhere in this model; v1's "10 of 12 needed" was wrong and is gone.

## Page header
Newsreader 22px/600 "Volunteer students" + role pill (MCT · whole course / ACT · teaching Pre-Intermediate today). Sub 13px muted: link sentence + the rule line generated from centre settings: *"Present means 2 of a session's 3 lessons and banks the whole 2¼ h; certificate at 160 h across all courses."*
Actions (34px, radius 6): **Filming consent form ↓** (link), **Register view link** (icon + label, the assessor-pack register), **Add student** (teal primary; toggles to **Cancel**).

**Add row** (only when open, white card, 1px teal border): Name · Class (select) · Email — helper "matches them to hours already on file" (the pool links by email match, never by name alone) · **Add and send link**.

## Today strip (white card, hidden when no TP session today)
Header: eyebrow `TODAY` (teal) · "Wed 15 · Class 6 of 12" · 12px muted "Replies come from the confirmation email; presence is logged from Zoom by the timetable. Nothing to enter here." Right: whole-course summary, tabular: `5 of 6 said coming · 1 can't · 0 no reply · 2 in the room`.

One row per class, grid `300px 1fr auto`:
- Left: class name 13px/600, meta 11px muted "17:00 · Class 6 · Listening — daily routines · Sara Yılmaz", then **headcount** 12px/600: before start `2 coming · 1 can't · 1 no reply`; once underway `2 in the room · 2 said they were coming`.
- Middle: one **chip per student** (30px pill, 14px ring + name + 10px tag). States, in precedence order:
  - **in the room** — Zoom has them now: teal ring filled ✓, teal 14% bg, teal border.
  - **coming** — replied Yes: teal ring 30% tint with dot, plain border.
  - **can't come** — replied No: red ring —, muted name, red 45% border.
  - **not joined yet** — said Yes / no reply but session underway and not on Zoom: red 8% bg, empty ring.
  - **no reply** — before start, no RSVP: gold 10% bg, gold border, amber tag.
- Right 11px muted: "Underway · present at 2 of 3 lessons" or "Starts 18:15 · nothing logged yet".
- Chips are **not interactive** (nothing to mark). Tooltip on chip = state + timestamp.

## Register (one white card per class)
Class header (page-tint bg): name 13px/700 · meta "3 students · today 17:00 · Sara Yılmaz · 1 drifting · 1 never opened link" · right **+ Share with class** (teal 11px/600; existing share flow, goes to every student in the class).

Column heads 10px/700 uppercase: Student · This course · 12 classes · Hours banked · of 160 · Link · (Copy).
Row grid `minmax(0,1.2fr) 196px 150px 132px 44px`, gap 14, padding 11px 16px, hairline dividers, whole row clickable → selects the card. Selected row: accent tint 45% + 3px inset teal left edge.
- **Student**: 28px initials tile (teal 55% tint, radius 8) + name 13px/500 + **drift note** 11px under the name: amber "2 one-lesson marks — leaving early" (≥2 one-lesson) or red "2 absences" (≥2 absent); blank otherwise.
- **This course**: 12 segments 13×16, radius 3, gap 3, one per class in the course. Present = ink filled · One lesson = half-filled (ink bottom half, linear-gradient) with ink border · Absent = red 18% fill, red border · Today = teal-dashed outline while unmarked, teal 30% fill once on Zoom · Upcoming = faint. Tooltip: "Class 5 · Grammar — past forms · Tue 14 · present".
- **Hours banked**: 13px/700 tabular `38.25 h` + 10px muted `1.75 h to 40` (next milestone) or "Certificate earned" · 4px gold bar, fill = hours/160.
- **Link**: 6px dot + 12px text: teal "Opened today" / gold dot + amber "Never opened".
- **Copy**: 11px teal, copies the student's link.

Legend row under the last class: Present · 2¼ h banked / One lesson · recorded, nothing banked / Absent / Today, in progress / Upcoming; right: "6 students · 2 classes · presence logged from Zoom by the timetable; face-to-face sessions are ticked by the tutor".

## Student card (440px, sticky, white)
- Head: 42px initials + Newsreader 20px name + 11px "Pre-Intermediate (A2+) · joined 6 Nov · email". Right: **Remove** (red outline 30px). Remove keeps the attendance record and kills the link (copy from v1).
- **Hours toward certificate** (gold 9% card, gold 30% border): eyebrow amber · `38.25 h of 160` 18px/700 · 6px gold bar on white track · tick labels 0 40 80 120 160 · line 12px amber: *"27 h from 1 earlier course + 11.25 h here. 1.75 h to the 40-hour milestone — 1 more class."* / *"Certificate earned. Hours keep accruing on the record."*
- **This course**: eyebrow + right 12px/600 `4 present · 1 one-lesson · 0 absent · 7 to come` · the same 12 segments at 22px tall · then one row per held class + today (newest first): 16px mark square · "Class 5 · Grammar — past forms" · state 11px (`Present · +2¼ h` muted / `One lesson · nothing banked` amber / `Absent` red / `In the room now` / for today before Zoom: `Said coming` / `Said can't come` / `No reply`) · date. Footer 11px: "Presence is Zoom join-to-leave time, summed across rejoins. Handouts appear on the student's link when the lesson is marked taught, attended or not."
- **Their link**: eyebrow + **Copy** / **Re-issue** (28px outline). URL box (truncated token). Facts: Today's reply (Coming / Can't come red / No reply to confirmation amber) · Last opened · Filming consent (amber "Not yet") · Expires "7 Dec (course end)". If never opened: gold-tint note "Never opened — the link probably didn't arrive. Re-issue and hand it over in class." Re-issue mints a new token, kills the old one, keeps attendance.
- Footer 11px: "Students see their own hours and a plain count of classes — no percentage, no threshold. They never see lesson plans, tutor feedback, grades, other students, or the portfolio."

## Roles
- **MCT**: everything above, both classes, all actions.
- **ACT**: same page and data (transparent system). Role pill names the class they teach today. No per-class restriction was found in the spec for volunteers; if Code has one, hide **Add student** / **Remove** / **Re-issue** for ACT rather than the data.

## Data needed per row
`volunteer_students` (name, class/level, email, joined, token, last_opened, consent_at, expires_at) · `volunteer_attendance` per event (join/leave sums → present / one-lesson / absent, computed with `computeSessionTicks` and the centre's thresholds) · hours across courses via `volunteer_person_id` (same math as the Centre Admin volunteer pool) · `volunteer_confirmations` + `volunteer_declines` for today's event · live Zoom participant state for "in the room".

## Interactions
- Row click → card. Add student toggles the add row. Copy → clipboard toast. Re-issue → confirm, new token. Remove → confirm. Share with class → existing share flow. Register view link → the assessor register (`Volunteer Register for Assessor.dc.html`).
- Hover: rows accent 28% tint; buttons teal border.
- Empty states: no session today → strip hidden; class with no students → header + one muted line "No students yet — add them above".

## Tokens
Ink `oklch(23.5% .017 65)` · Muted `oklch(51% .017 70)` · Teal `oklch(38% .072 195)` · Teal tint base `oklch(92% .028 190)` · Gold `oklch(60% .11 70)` · Amber ink `oklch(44% .095 68)` · Red `oklch(45% .16 27)` · Page `oklch(92.5% .012 85)` · Section `oklch(96.4% .014 85)` · Card `oklch(99.2% .005 90)` · Faint `oklch(93.5% .012 85)` · Border `oklch(88% .016 82)`. Fonts Karla (UI), Newsreader (headings). Radii: cards 6, tiles 8/12, pills 999. Green is not a meaning — present is ink, not green.

## Files
- `Volunteer Students v2.dc.html` — the design (needs `support.js` beside it).
- `Volunteer Register.dc.html` — v1, superseded (kept for the "never on this card" list and copy).
- `support.js` — runtime.
- `for-claude-code-volunteer-students-v2.md` — the build spec with the corrections to the current page.
- `for-claude-code-volunteer-rsvp.md`, `for-claude-code-volunteer-messaging-complete.md`, `for-claude-code-zoom-auto-attendance.md` — the upstream specs this page depends on.
