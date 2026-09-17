# Demo clock — open the demo on any course day (16 Sep 2026)

For Claude Code. Companion to `Course Story.dc.html`, which now links every card to `/demo/<role>?day=N`.

## Why
The demo centre is seeded at one frozen moment (mid-week 2). Every demo entry drops the viewer there. The course story wants to show the course from the first application to the last PDF, so each card needs to land on its own day, as that role.

## What to build

### 1 · A demo clock cookie
- `/demo/<role>?day=N` (any existing demo route: `centre-admin`, `centre-owner`, `course-admin`, `trainer`, `trainer-act`, `trainee`, `volunteer`, `assessor`) sets a cookie `demo_day=N` before redirecting, then proceeds as today.
- `N` is a course day: 1–20 are teaching days in order (Mon–Fri, four weeks); 0 is the day before Day 1; negative values are pre-course days; values above 20 are after the course (21+ = close-out, ≥ 40 = wiped).
- One helper, `demoNow(timeZone)`, returns the instant to treat as "now": for a non-demo centre it is `new Date()`; for the demo centre with `demo_day` set, it is Day N of the demo course at 09:00 in the centre's zone (or the real clock time on that day, so the day bar and Your day still move).
- Every place that reads the wall clock for **course state** goes through it: `toLocalIso(new Date(), tz)` call sites, `computeCourseState`, `computeWeekOf`, the timetable's "today", the trainee hero, the header day bar, the volunteer "next class", assignment release gating, Catch up. Audit by grepping `new Date()` under `src/app` and `src/lib`; timestamps written to the database stay real.
- Only when `centers.is_demo` is true for the viewer's centre. Real centres never see a shifted clock.
- The header clock shows the shifted day with a small "Demo · Day N" tag beside "Day N of 20" so nobody mistakes it for live.

### 2 · Seed the whole course, not a snapshot
`scripts/seed-demo.mjs` currently seeds a mid-week-2 state (4 TPs graded for the richest trainee, two assignments approved). For the clock to mean anything, the seed has to hold the **finished** course and let the clock decide what is visible:
- All eight TPs for all six candidates: plan, LA, materials, self-evaluation, tutor feedback (with starred points chaining into the next plan), submitted with timestamps on their real day.
- All four assignments per candidate: released the evening before their Q&A slot, round 1, feedback, round 2, outcome, with one "not to standard" and one late so the gating shows.
- CELTA 5: Stage 1, 2, 3 entries, one candidate on a formal letter path.
- Tutorials, filmed observations, consultations booked on the timetable's days.
- Volunteers: two levels, attendance ticks per class day, RSVPs, one decline, hours crossing the certificate threshold in week 4.
- Assessor: named Day 16, pack opened, sample chosen, visit Day 19, report and grade approval dated after Day 20.
- Centre: payments as instalments with one missed in week 1 and paid in week 2, one refund pending; entry form sent Day −14; grade form Day 18; approval Day 23; export run Day 25; wipe Day 40.
- Every timestamp is relative to the demo course's start date, so `pickDemoCourse` keeps working when the seed is re-run.

Visibility then falls out of the existing rules: a candidate on Day 4 sees TP1 feedback and a draft TP2 plan; the same candidate on Day 19 sees eight; on Day 23 sees the grade because Cambridge has confirmed; on Day 40 hits the "course has closed" gate.

### 3 · Admissions stages
Pre-course days are already covered by `/demo/journey/{apply,interview,interview-record,offer,volunteer-signup}`. The story links those cards there directly. Add `?stage=` to `/demo/centre-admin` so the Admissions room can open with the seeded applicant at a given stage (`submitted`, `task_returned`, `interview_booked`, `offer_sent`, `accepted`): seed one applicant per stage, and let `?stage=` scroll/highlight that row.

### 4 · The story page itself
Ship `Course Story.dc.html` as `/demo/story` (a static page; the DC's markup ports to a server component with no data). It replaces the eight-card `/demo` landing as the first thing a visitor sees; the eight role links move into the story's header pills, which they already are.

## Order
1 (clock) → 2 (seed) → 4 (story route) → 3 (stage param). The clock alone, on the existing snapshot, already makes days 6–10 land correctly; the seed makes the other 30 days true.
