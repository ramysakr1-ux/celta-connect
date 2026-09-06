# Assessor landing — v2 build spec (candidate wall)

Design: `Assessor Landing v2.dc.html`; README.md in this folder has every measurement and colour. Files touched: `src/app/assessor/page.tsx`, `src/app/assessor/appian-reference.tsx`, `src/lib/assessor-pack-contents.ts`, `src/lib/assessor-requirements.ts`.

## 1. Purpose
The assessor's reading list for the days before the visit. Candidates as cards, grouped in Handbook order with a one-line reason each; the pack, the day and the Handbook in a rail. Read-only, token-gated as today.

## 2. Remove from the current page
Dark header bar, the four readiness figures, the provisional-deadline banner, the inline "what this assessment requires" band at the top, inline malpractice cases, candidate readiness dot rows in a table. Keep: Appian reference (moved under the header buttons), pack contents, requirements list (moved to the rail), read-only notice (one line).

## 3. Candidate grouping
```
observe   = candidate teaches in a TP slot on visit_date
fail      = provisional in {Fail, Fail/Pass} and not observe
passA     = provisional == Pass A and not observe
centre    = selected_by_centre and none of the above
withdrawn = withdrawn_at != null
```
Sections render in that order; empty sections are omitted. Default view: `selected_by_centre || observe || fail || withdrawn`. "View the whole cohort" adds everyone else into `centre`.
Card `why` text per section (README) + appended `issue` string when any completeness check fails. Card links to `/assessor/candidates/{id}`.

## 4. Completeness (three dots)
- `celta5`: CELTA 5 signed for every completed stage.
- `tp`: every taught TP has published tutor feedback.
- `assignments`: every submission (incl. resubmissions) has a mark.
Issue text is the first failing check, phrased as in the design ("CELTA 5 stage 2 not signed.", "Assignment 3 resubmission not yet marked.").

## 5. Pack rail
Source `assessor-pack-contents.ts`, cohort docs then centre docs. Each row: state `in | part | missing | later`, name, short meta. Status line `{in} of {total} in · {missing} missing · {later} on the day`. Row → document viewer. `part` is currently only the grade form (confirmed provisionals / total).

## 6. Day rail
Visit-day events from the course timetable filtered to the assessor's day: arrival, TP slots (candidate + point), standard-setting + feedback, candidate meeting, grading meeting. TP rows bold. Footer copy fixed.

## 7. Requirements rail
`assessor-requirements.ts` items with Handbook cite; interpolate course numbers (Fail count, meeting requests, withdrawn count). Mark `hot` when the interpolated number is > 0 for Fail — detail renders red.

## 8. Also on file
Three links: malpractice cases (count · outcome), provisional grades (confirmed / total → grade form), input schedule (Moodle link or "n/a · face-to-face").

## 9. Header
Wordmark, read-only pill, one-line notice with link expiry; Newsreader title `{centre} · CELTA, {month year}`; context line `{dates} · {n} candidates · MCT {name}, ACT {name} · your visit {date}, {n} days from now` ("today" on the day). Buttons: Open Appian, Download whole pack. Course notification reference with Copy.

## 10. Open questions
- Should `observe` be locked to the two the centre has scheduled, or show all three TP7 slots (design shows the two flagged by the centre; the third slot is on the day rail)?
- Does "Download whole pack" exist server-side, or should it be dropped until it does?
