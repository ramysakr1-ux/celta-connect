# Volunteer student view — full spec (no tabs, no account)

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Volunteer View.dc.html`.

Like the assessor, a volunteer has **no account** — one personal link, phone-first (most open it on the way to class). Two layouts share identical content: 1a (phone, primary) and 1b (desktop, same data plus an explicit "what this never shows" panel). Link dies when the course ends; a "download all my materials" action sits directly beside that fact.

## Header
Connect mark + wordmark (current tile lockup), volunteer's first name (phone) or full name + "volunteer student" (desktop) on the right. No nav — this is a single scrolling view, not a tabbed app.

## Content (in order, phone; same data reflows into a table + sidebar on desktop)

1. **Centre name + "Your next class is tomorrow"** heading.
2. **Next class card** — date, time, where, topic, teachers. "Join online" (primary) + calendar-add icon buttons. Below a divider: "Can't make it? → Let them know" — a one-tap decline, not an email, because attendance changes the lesson (a TP with two learners is different).
3. **Your classes** — list of past + next classes, each with a status pill (Attended / Missed / Upcoming) and a materials link. Materials remain visible even for missed classes — the language content is still the point, not just proof of attendance.
4. **Your hours** — big figure (current hours), a line stating hours remaining to certificate ("You are N hours from your certificate. Every class adds 2¼ hours"), a progress bar, and 4 milestone markers (e.g. 40/80/120/160 hrs — Earned/Next/—/Certificate). Footnote: "Every class counts, whichever level you are in. Stay for at least two of the three lessons and the class is yours."
5. **This course** — a separate, simpler tracker: N of M classes attended as a dot row, no percentage, no threshold language. Deliberately kept apart from the certificate math.
6. **Footer** — link expiry date and "Download all my materials" action.

### Desktop-only addition (1b)
A "What this link never shows" panel, always visible, listing exactly what's excluded: no candidate names beyond who's teaching that day, no lesson plans/feedback/grades/assessment of any kind, no other volunteer's details or attendance, no account/password/sign-in.

## Governing decisions (carry into the build)
- **Hours are the unit, never levels or courses.** Volunteers move between levels depending on what's running, and one CELTA course only gives about 30 hours toward the ~200 Cambridge suggests per CEFR level — so neither a level nor a single course is the right measurement unit.
- **Certificate threshold = 160 hours** (80% of Cambridge's 200-hour guide). The volunteer never sees that calculation, only a number to reach and distance remaining. Milestones at 40/80/120 keep the next post always close enough to matter.
- **Attendance credit: 90 minutes of Zoom time (summed across rejoins) earns the whole 2¼-hour class**, generous by 45 minutes, specifically to remove any incentive to clock-watch.
- **The next class is the entire first screen** — a volunteer opens this to answer one question (when/where), everything else is secondary and below it.
- **Expiry is stated as a promise, not a warning** — paired directly with the download action, not discovered later after data is already gone.

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (action) `oklch(38% 0.072 195)`, brown/ink-warm (milestones, mark) `oklch(30% 0.042 58)`, gold accent `oklch(60% 0.11 70)` / `oklch(70% 0.12 72)`, card `oklch(99.2% 0.005 90)`, cream shell `oklch(96.4% 0.014 85)`, border `oklch(88% 0.016 82)`. Fonts: Karla (UI), Newsreader (headings), Instrument Serif italic (wordmark).
