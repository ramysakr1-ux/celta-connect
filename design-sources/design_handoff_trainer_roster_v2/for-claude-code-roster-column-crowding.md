# Roster page — 18 columns where the design called for 6

## What the design specified

`specs/for-claude-code-trainer-remaining-screens.md` §2: "One panel, full width: a table, one row per candidate — Assessed hrs, TPs, Assignments left, Criteria %, Attendance %, Provisional grade." Six data columns plus name.

## What's actually built (`roster/page.tsx`, `roster-row.tsx`)

Eighteen columns, all in one flat table: Candidate, Contact ("Outside Connect"), Assessed hrs, TPs passed, Assignments, Criteria, Attendance, TP stages, Supervised review, Observation hrs, Stage 1 report, Stage 2/3, CELTA 5 sign-off, FOL logged, Standing (trajectory bar), Provisional, Obs. tasks, At risk.

To be fair to Code: most of these aren't invented. TP stages, Supervised review, Observation hrs, Stage 1/2/3, CELTA 5 sign-off, FOL logged, and Standing all came from real features built after the original 6-column spec was written (unified tracking, the grade pipeline, FOL pooled evidence). The data itself is legitimate. What never happened is a pass to reorganize the table once all of that landed — everything just got appended as another column.

Above the table, the header row alone stacks 8 actions/links: Pre-course tasks, Observation tasks, Observation hours, Day-one activities, Export CSV, Email all candidates, Share assessor link, Add candidate — plus, conditionally, two more full-width info bars (FOL pool by class, Filming consent) before the table even starts.

## The actual problem

A trainer opening Roster to just glance at where candidates stand can't take it in — 18 columns force horizontal scroll, and the header buries the two or three things a trainer actually clicks often (Add candidate, Export CSV) among five links that are really navigation to other pages, not roster actions.

## Fix direction (not a full redesign — needs your call on specifics)

1. **Split "core standing" from "detail drill-downs."** A trainer scanning the roster wants the original 6: Assessed hrs, TPs, Assignments, Criteria %, Attendance %, Provisional grade — plus At risk (that one's load-bearing, it's the whole point of a glance-table). Everything else (Supervised review, Observation hrs, Stage 1/2/3, CELTA 5 sign-off, FOL logged, Obs. tasks, Standing/trajectory) is legitimate but is progress-tracking detail, not "is this candidate okay right now" — it belongs one click deeper, on the Portfolio page (which the spec already says is what a Roster row should open into), not duplicated on the roster's own row.
2. **Header links that are navigation, not roster actions** (Pre-course tasks, Observation tasks, Observation hours, Day-one activities) — move these out of the roster's own action row into wherever the Teaching Practice/Volunteers tabs' own subnav lives, per the original nav spec ("Rotation, Portfolio and Announcements are not tabs — they're reached by drilling into Teaching Practice"). Roster's own header should keep just Export CSV, Email all candidates, Share assessor link, Add candidate.
3. **FOL pool + Filming consent bars** — these are useful centre-specific summaries, not roster rows. Confirm whether they're meant to always show above the table (as now) or would fit better as their own small section/tab so Roster's first screenful is candidates, not admin bars.

## Ask Code

Confirm which columns are actually consulted from the roster view itself (vs. always drilled into via Portfolio) before cutting anything — some trainers may rely on comparing e.g. Observation hrs across the whole cohort at a glance, which is a legitimate reason to keep a column rather than move it. Don't remove data mechanically; reorganize with that check first.
