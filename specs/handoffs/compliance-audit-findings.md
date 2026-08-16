# Compliance audit — findings against the live repo

Worked through `for-claude-code-compliance-audit.md` on 2026-08-16 by grepping
for each rule's mechanism, as that spec asks. Verdicts below are per item, with
the file where one was found.

**Headline: of the 16 unconfirmed items, 14 are genuinely not built, 1 is
partially built, and 1 turned out to be built already.** The audit's own caution
held — "unconfirmed is not proof they're missing" — but in this case most were.

## Group 1a — timetable/TP rules

| # | Rule (Handbook) | Verdict |
|---|---|---|
| 1 | Candidate can't teach twice in one day; tutor not expected to observe two groups in one day (8.1.4) | **Not built.** No same-day check anywhere. The 3-hours-per-day maximum isn't enforced either |
| 2 | Five of six assessed hours whole-class; the exception can't be either of the final two (8.1.4) | **Not built.** "whole class" exists only as lesson-plan vocabulary (`tp-density.ts`, `celta-criteria.ts`), never as an hours rule |
| 3 | Half of TP with classes averaging 8 students | **Not built** — no class-size figure is computed anywhere. The audit marked this design-only; confirmed there's no live stat |
| 4 | TP distributed evenly between the two tutors (2.4) | **Not built.** `running-order-panel.tsx` shows who carries which *position*, which is a different fairness question |
| 5 | Intensive TP: 2-day minimum break, max 6 consecutive days (8.1.4) | **Not built.** The only "consecutive" logic is back-to-back fails in `at-risk.ts` |
| 6 | Mixed-mode Stage-3-borderline: final two lessons locked to one mode (9.2) | **Not built** |
| 7 | Assignment materials vs TP lesson materials overlap check (8.2) | **Not built.** "overlap" appears only for timetable bands |
| 8 | End-of-course reports blocked before the final day (13.6) | **Not built — and this one has teeth.** `releaseAllFinalReports` (`celta5-actions.ts:528`) sets `final_report_released_at` with no date check at all, so a full cohort's reports can be released on day one |

## Group 1b — administrative deadlines and eligibility

| # | Rule | Verdict |
|---|---|---|
| 1 | Course-date submission deadline surfaced as a task, 4wks Moodle / 2wks other (3.1) | **Partially built.** `courses.entry_form_sent_at` is recorded on the admin course form, but nothing computes the deadline or surfaces it — no task, no alert, no Today-screen line |
| 2 | Certificate-vs-recommended-grade check reappearing at close-out (10.5) | **Built.** `course-close-out/blocking-rules.ts:30` blocks close-out until `cambridge_grades_confirmed_at` is set, and the export carries `recommendedGrade` |
| 3 | Tutor can't be assigned to two concurrent full-time courses (2.4) | **Not built.** Nothing checks a tutor's other courses when assigning |
| 4 | Assessor history per centre — 2 consecutive / 2 concurrent, visible not enforced (12.3) | **Not built.** `assessor_visit_date` exists per course; no history view across courses |

## Group 1c — candidate-owed items

| # | Rule | Verdict |
|---|---|---|
| 1 | Assessor's candidate-concerns meeting on the timetable, announced in advance (14.2) | **Not built** |
| 2 | "Consultation" as its own timetable band matching the syllabus's 120-hour breakdown | **Not built as a band.** `read-only-board.tsx:14` documents the opposite decision — the 5-bucket model has no separate consultation category, so it folds into `iw`. A deliberate earlier choice that now conflicts with this audit |
| 3 | Candidate information sheet folded into enrolment, populating the CELTA 5 header | **Built.** `portfolio/[traineeId]/celta5/page.tsx:190,521` populate front matter from live data |
| 4 | Cambridge documents shelf at organisation level | **Partially built.** `resource-hub/page.tsx:232` lists syllabus and appeals among blank forms, but there's no organisation-level shelf holding the handbook and authorisation certificate |

## The two worth acting on first

**1a.8 — reports releasable before the final day.** Every other gap is a missing
guard against something a centre probably wouldn't do by accident. This one is a
single button that breaches Handbook 13.6 with no friction, and releasing early
can't be undone in the candidate's memory.

**1b.1 — the entry-form deadline.** Two weeks before the course (four for
Moodle) is a hard Cambridge date, the field to compute it from already exists,
and nothing surfaces it. That's a cheap fix with a real consequence if missed.

## Note on 1c.2

This is not a gap so much as a contradiction between two of Ramy's own
decisions: the timetable's 5-bucket model deliberately has no consultation
category, and this audit wants one. Needs his call, not a build.
