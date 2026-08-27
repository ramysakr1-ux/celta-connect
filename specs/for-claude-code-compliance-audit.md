# Compliance Audit — 19 gaps found against Cambridge documents, checked against design

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Compliance Audit.dc.html` — read that file's full item text (`title`, `what`, `src`, `quote`, `fix`) for the complete wording; this file is the scan checklist.

Sources audited: Administration Handbook (2022 edition -- no 2026 edition of this document exists; corrected 2026-08-27 after a later audit found the original "2026" citation here was fabricated), Syllabus and Assessment Guidelines 5th edition, CELTA 5 (April 2021 / July 2023 revisions), three centre guidance documents. No contradictions found — only omissions. Status below reflects a spot-check against the live repo on 14 Aug 2026; unconfirmed items were not found by a quick code search, which is NOT proof they're missing — verify directly.

## ✅ Confirmed built (3)
1. **Two of four assignments in academic prose** — `src/app/dashboard/admin/assignment-briefs/[id]/page.tsx` blocks publish unless exactly 2 of 4 briefs are prose format.
2. **Quiet hours derive from the timetable** — `src/lib/timetable-grid.ts` computes "quiet hours" from the day's last timetabled session, not a fixed clock time.
3. **Asynchronous input needs a linked live follow-up** — `src/app/trainer/(hub)/timetable/page.tsx` blocks locking the timetable if an async input session has no linked live slot.

## ⬜ Unconfirmed — group 1a: timetable/TP rules nothing currently checks (7 remaining)
1. Candidate can't teach twice in one day; tutor not expected to observe two groups in one day (Handbook 8.1.4).
2. Five of six assessed hours must be whole-class; the exception lesson can't be either of the final two (Handbook 8.1.4).
3. ~~Half of TP with classes averaging 8 students~~ (design-only: showing a derived figure, not enforcing — check if built as a live stat).
4. TP distributed evenly between the two tutors (Handbook 2.4).
5. Intensive TP block: 2-day minimum break, max 6 consecutive days (Handbook 8.1.4).
6. Mixed-mode Stage-3-borderline candidates: final two lessons locked to one mode (Handbook 9.2).
7. Assignment materials vs. TP lesson materials overlap check (Handbook 8.2).
8. End-of-course reports blocked before the final day (Handbook 13.6).

## ⬜ Unconfirmed — group 1b: administrative deadlines/eligibility (4 remaining)
1. Course-date submission deadline surfaced as a task (4 wks Moodle / 2 wks other) (Handbook 3.1).
2. Certificate-vs-recommended-grade check reappearing at close-out (Handbook 10.5).
3. Tutor can't be assigned to two concurrent full-time courses (Handbook 2.4).
4. Assessor history visible per centre (2 consecutive / 2 concurrent limits, not enforced by design, just visible) (Handbook 12.3).

## ⬜ Unconfirmed — group 1c: candidate-owed items (5 remaining, minus the 1 confirmed)
1. Assessor's candidate-concerns meeting on the timetable, announced in advance (Handbook 14.2).
2. "Consultation" named as its own timetable band, matching the syllabus's 120-hour breakdown.
3. Electronic candidate information sheet folded into enrolment, populating the CELTA 5 header (CELTA 5 front matter).
4. Cambridge documents shelf: syllabus, handbook, authorisation certificate, appeals procedure, at organisation level (CELTA 5, centre responsibilities).

## What to check
For each unconfirmed item, grep the repo for the rule's mechanism (e.g. "consecutive", "whole class" hour tracking, "concurrent" tutor/course assignment, "candidate concerns" meeting, "consultation" as a timetable category) and report back per item: built / partially built / not built, with the file and line if found.
