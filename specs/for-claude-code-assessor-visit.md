# Assessor Visit.dc.html — full design spec

Single screen, no tabs, no account — tokenised link, expires after a set date. Nothing editable; no action recorded against a candidate.

## Colors (oklch)
Ink `oklch(23.5% 0.017 65)` · muted `oklch(51% 0.017 70)` · warm dark banner/header bg `oklch(30% 0.042 58)` · teal (action/links) `oklch(38% 0.072 195)` · gold (Pass A / attention) `oklch(60% 0.11 70)` · red (Fail) `oklch(45% 0.16 27)` · amber (needs attention) `oklch(44% 0.1 68)` · silver (Pass B) `oklch(65% 0.008 90)` · green (complete/good) `oklch(48% 0.09 150)` · card `oklch(99.2% 0.005 90)` · border `oklch(88% 0.016 82)` · page bg `oklch(92.5% 0.012 85)`.

## Fonts
Karla (400–700, UI/body), Newsreader (500/600, headings/serif numerals).

## Layout (1620px canvas)

**Top banner** (full-width, warm-dark bg, cream text, 10px/32px padding): "Assessor access — read-only. Nothing you open here can be edited, and no action you take is recorded against a candidate." + link expiry date, right-aligned.

**Header** (60px, white bg, bottom border, 32px side padding): 30px ink-tile mark + italic "Connect" wordmark (static) + divider + gold-tinted "Assessor · read-only" pill — left. "Download whole pack" button (outlined, download icon) — right.

**Body** (28px/32px/44px padding):
- Title block: eyebrow "[centre] · [Cambridge code] · [course code] · [dates]" → Newsreader 28px "Assessor visit — [date]". Right-aligned: 4 readiness stat figures (Send by / Portfolios complete / Hours logged / Grades entered), Newsreader 21px values, colored by status.
- Readiness callout bar (gold-tinted, full width): "Send the pack by [date]" bold + "Everything below must be complete by that date, not the visit date."
- Main grid, 1.6fr : 1fr, 20px gap:
  - **Left — Candidate portfolios**: 2-column card grid, one per candidate. Each card: name + grade pill (Pass A gold / Pass B silver / Pass neutral / Fail red), meta line (TPs/hours/level), 3 status dots (CELTA 5 record / TPs / Assignments, green=met amber=not), and — if flagged — an amber note ("Stage Three record still open," "Assignment 3 resubmission unresolved") with amber card border. Click → replaces grid with a full-portfolio drawer (dark header with candidate name + Close button, then 6 rows: CELTA 5 record, Teaching practice, Assignments, Attendance, Special arrangements, Provisional grade — each with value + status).
  - **Right — 4 stacked panels**:
    1. *Cohort documents*: Grades report, Course timetable, Assignment titles, Tutor list and roles, Candidate descriptions, Lesson plans for the day — each row "Live" status (green) + "Open" action (teal).
    2. *On the day* (gold label, gold-bordered card): time-stamped schedule (TP observation slots with in-person/online + Zoom-link timing, tutor meeting, candidate-concerns meeting per Handbook 14.2), footer line counting candidates who raised something for that meeting.
    3. *Centre documents*: Centre authorisation certificate, Candidate agreement & policies, Application files (including rejected applicants), Volunteer attendance registers, Double-marking record, Sample end-of-course report, The previous assessor's report, Marking guidance — each with a one-line meta caption.
    4. *Not in this pack* (muted card, no action items): the assessor's own report (goes to Cambridge's secure system), staff chat (trainer-only, resets on schedule), trainee-only chat (privacy boundary) — each with a one-line "why."

## Exact terminology (checked against `running-a-course.md` / Handbook)
- "Grades report" (not "provisional grade report") — matches the actual file `Grades Report.dc.html`.
- "Assignment titles" (not "assignment briefs") — the assessor pack's term specifically.
- "Application files (including rejected applicants)" — verbatim.
- "Candidate-concerns meeting" — Handbook 14.2's term, not "candidate conversations."
- "The previous assessor's report" — verbatim, distinct from "sample end-of-course report."
- Full official pack contents list (Handbook): portfolios, candidate descriptions, the timetable, the TP schedule for the day, assignment titles, application files (incl. rejected applicants), lesson plans for that day, volunteer attendance registers, the double-marking record, a sample end-of-course report, and the previous assessor's report.

## Source
`Assessor Visit.dc.html` (full working file, included).
