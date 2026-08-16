# Course Admin.dc.html — full design spec

## Color palette (oklch) — audited, no true green remains
Ink `oklch(23.5% 0.017 65)` · muted `oklch(51% 0.017 70)` · warm dark (rails/callouts) `oklch(30% 0.042 58)` · teal (accent/primary/links) `oklch(38% 0.072 195)` · bronze `oklch(50% 0.09 62)` · gold (invited/attention) `oklch(60% 0.11 70)` · red (destructive, e.g. "Regenerate") `oklch(45% 0.16 27)` · border `oklch(88% 0.016 82)` · card `oklch(99.2% 0.005 90)` · page bg `oklch(92.5% 0.012 85)`.
A `GREEN` variable name exists in code for historical reasons but resolves to the same ink tone as everything else — no hue near green is rendered anywhere on this page (fixed 16 Aug: the "Centre number set" callout previously used a real green dot/tint, now the warm dark tone).

## Fonts
Karla (400–700, UI), Newsreader (500/600, headings/serif figures).

## Screen 1a — Centre home: courses by state
Wordmark + centre name/number header. Callout bar (warm-dark tint): "Centre number set — UK205 · Prints on every final report and cover sheet."
Courses grouped by state — **Running** (green-adjacent removed, ink label) → **Upcoming** (teal) → **Closed** (muted) — never sorted by date alone. Each row: course code/dates, people count, progress label, state pill.
Centre material row (TP points library, assignment briefs, resource hub, feedback style examples, coursebooks counts).
Admin↔tutor chat pill: per-course channel, retention selector (Nightly/Weekly/Custom-days).

## Screen — Course setup wizard (6 steps, steps 1–2 designed)
**Step 1 — Course details** (new, added 16 Aug): centre number (locked, prefilled from centre profile), course code, internal course name, start/end dates, max cohort size. Sidebar notes: tutors are NOT assigned here — added later from the roster (1b); centre number is set once, changed only in Centre Admin.
**Step 2 — Delivery mode**: radio-style cards (Face-to-face / Fully online / Mixed-mode), each with description; selecting one reveals a mode-impact box (Timetable / Required extras / Observations / Tutors / Length rows) and a "Continue to dates" action. Sidebar: 4 rule notes (asked once, mode is about TP not input, changing later is a real change requiring JCA sign-off, Moodle changes what the assessor needs).
Steps 3–6 (dates confirmation, capacity/pricing, tutor assignment, review-and-launch) are still unbuilt.

## Screen 1b — One course: roster, groups, invitations
Header: course code/dates/mode/week, "Duplicate course" + "Invite people" actions.

**Roster** — one row per person (name / email / role / join-state pill). Tutor rows: role is a **clickable dropdown** (added 16 Aug) — click the role text to open a menu of Main Course Tutor / Assistant Course Tutor / TP Tutor / Input Tutor / Assessor (if known); picking one reassigns that person's role on this course immediately. Candidate rows show plain "Candidate" text, not clickable. Join-state pill (Joined/Invited) is deliberately distinct in color from the role text.

**Teaching practice groups** — two side-by-side group cards, each with assigned tutor + meeting days, members split First half/Second half. Warning banner when candidates aren't grouped yet (rotation blocked).

**Invitations panel**, redesigned 16 Aug:
1. *Invite a tutor by name* (new) — email field + role dropdown (same 5 roles as the roster menu) + "Send invite as [role]" button. The role travels with the invite; whoever accepts joins already assigned. Caption clarifies the role can still be changed later from the roster.
2. *Or share a general link* (renamed from the old sole option) — one card per role-link (Candidate link, Tutor link) with usage count, the link itself, and Copy / Email it / Regenerate in one row. Regenerating invalidates the old link immediately (stated as a footnote next to the button).

Sidebar: "What changed" notes.

## Screen 1c — Settings
Left rail: Centre profile, Google Drive, Assignment briefs, Feedback style, Tutors — active item gets a colored left rule; a flag dot marks anything needing attention. Centre profile fields: centre name + Cambridge centre number (both print on every course's cover sheet/final report).

## Source
`Course Admin.dc.html`, full working file, included.
