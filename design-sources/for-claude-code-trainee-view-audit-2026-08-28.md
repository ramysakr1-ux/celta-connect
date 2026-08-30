# Trainee view + timetable audit vs. specs — 28 Aug 2026

Checked live code at `ramysakr1-ux/celta-connect@preview/centre-admin-import` against `for-claude-code-trainee-interface.md`, `for-claude-code-timetable-view.md`, `for-claude-code-five-week-shapes.md`, `for-claude-code-assignment-schedule-rule.md`, `for-claude-code-trainee-assessor-card-system.md`.

## 1. Today tab — matches spec closely
`today-tab.tsx` implements the spec correctly: "You teach today" hero card (teal/primary accent, gated to teaching days, Join the room + Open your plan), Announcements (capped at 3, pinned bold with rule, author + relative time), Waiting on you (capped at 3, priority-ordered, letters never bumped off). Card edges alternate green/garnet per `for-claude-code-trainee-assessor-card-system.md`. No drift found here.

## 2. Navigation — real drift from spec
Spec (`for-claude-code-trainee-interface.md`) says: **"Nav: Today, Timetable, My teaching, Assignments, Resources — five tabs, center of a 56px header."**

Live build (`trainee-sidebar-nav.tsx` + `layout.tsx`) uses a **left sidebar rail**, not centered header tabs, with **seven** items and different labels:
`Course Stream, Pre-course task, Resource Hub, Teaching Practice, Written Assignments, CELTA 5, Progress`.

- "Today" → folded into "Course Stream" (label changed, and also covers Timetable + tutorial booking as sub-pages, not its own tab).
- "My teaching" → "Teaching Practice."
- "Assignments" → "Written Assignments."
- "Resources" → "Resource Hub."
- Two extra top-level items with no spec entry: **Pre-course task**, **CELTA 5**, **Progress**.
- Timetable has no top-level nav entry at all — reached only via "My timetable" button from Today.

This is a deliberate, commented decision in the code (not an oversight) — a comment in `trainee-sidebar-nav.tsx` explicitly says it's "a genuinely different grouping ... matching the mockup's seven items exactly" — but it does **not** match `Trainee Walkthrough.dc.html`'s five-tab spec as written. Worth a real decision: either the spec is stale (update it to match the shipped 7-item sidebar) or the build should be pulled back to 5 tabs. Recommend confirming with Ramy which is current intent before either side is "corrected."

## 3. Grades — spec violation
Spec: **"No grades tab, no grades anywhere in the trainee app."** Assignments spec (§4) only calls for an outcome pill (Pass / Pass on resub / Due today / not yet open) — no grade.

Live `assignments/page.tsx`'s `AssignmentCard` renders: `{a.final_grade ? <p>Final grade: {a.final_grade}</p> : null}`. This is a real spec violation, not a nuance — flag for removal if the "no grades" rule still holds.

## 4. Assignments tab — otherwise matches
Four assignments, 3-of-4-to-pass footer logic present (`passedCount`/`standardAssignments.length`), resubmission status shown inline, locked/"Not yet open" state gated on the linked input-session's timetable date (a stronger, timetable-driven version of the spec's simpler gating). "1 due today" heading + shortcut present. Plagiarism Reflection (Assignment 5) correctly kept out of the 3-of-4 count and visually separated — this is a documented addition beyond the original spec, not a drift.

Not yet checked against spec: live word-count-vs-target validation on the submission form itself (flagged separately as outstanding in `for-claude-code-assignment-compliance-audit-v2.md` item 13 — still not confirmed fixed).

## 5. Timetable — read-only view matches spec structure, content completeness unconfirmed
`portfolio/[traineeId]/timetable/page.tsx` implements the spec's structure correctly: 4-week grid, "Mine"/"Everything"-equivalent involvement logic (`isMineEvent`), TP letter-group codes, "You teach" tagging, volunteer attendance counts (an approved addition beyond the original spec), calendar export.

**Known gap, not yet re-verified as fixed:** `for-claude-code-timetable-seed-data-gap.md` (23 Aug) found Week 3 of a live demo course rendering only 2 of what should be a full week of tiles across all 5 categories (whole-group, group-room, admin, individual, lunch) — everything else empty. That note frames it as a seed-data completeness issue, not a rendering bug. I did not re-check live seeded course data in this pass (no DB access from here) — recommend a live screenshot check of Weeks 1–4 on a real/demo course to confirm all 20 teaching days are now fully populated, not just the two that had events on 23 Aug.

The underlying **content library** does look complete: `generate-skeleton-form.tsx` confirms the skeleton generator produces the same `STANDARD_CELTA_SKELETON` 20-day content set regardless of course shape (four-week Mon–Fri, five-week Friday-off, five-week Wednesday-off), consistent with `for-claude-code-five-week-shapes.md`'s "identical 20 days, recalendared" rule. So the 4-week shape's full grid (9 time bands × 20 days, 5 categories) exists as authored content — the open question is whether every *demo/seeded course instance* actually has it inserted, or whether some instances only got a partial insert.

## Open items to resolve
1. Nav structure: 5 tabs (spec) vs. 7-item sidebar (live, intentional) — needs a decision, then whichever side is wrong gets corrected.
2. Remove `final_grade` display from assignment cards, or confirm the "no grades" rule has since changed.
3. Re-verify Week 1–4 timetable data completeness on a real course instance (visual check, not just code review).
4. Assignment word-count live validation — still open per the Aug 22 compliance audit, not re-checked here.
