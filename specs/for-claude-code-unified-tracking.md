# Unified candidate tracking — one system, not eight

Written 15 Aug 2026, for Claude Code. Supersedes any per-activity tracking screen built ad hoc (the standalone "Supervised review — completion" screen, any one-off observation-hours view, etc.) — this is the one system. Stop building bespoke completion screens per activity type; add a column here instead.

## The problem this fixes

Trackable trainee activity has been accumulating its own bespoke screen per type: a dedicated screen for supervised-review quiz completion, a separate view for observation hours, Stage 2 booking status living only on its own sheet, and so on. That's eight-plus different patterns for the same underlying question — "has this candidate done X, and how well." One system, one place.

## The one system: Roster → Standing table, extended

Every trackable item is a **column** on the existing Standing table (Roster tab), one row per candidate. Not a new screen per activity. Columns group into the same status vocabulary everywhere: **Done / Pending / Overdue**, plus a secondary value (score, hours, position) where relevant.

### Full list of what's trackable today, and its column

1. **Attendance** — existing register/Zoom auto-tick, **trainee course attendance only** (not volunteer/TP-student attendance, which is tracked separately in the volunteer view and feeds the assessor pack from there). Column: % + hours credited.
2. **TP lesson stages** (per round) — plan submitted, self-evaluation written, feedback returned. Column: pill per stage or a single "on track / behind" rollup, with the per-TP detail one click away (existing '1c My teaching' pattern stays as the drill-down, not replaced).
3. **Supervised review quizzes** — Column: Done/Pending + score (e.g. "9/10") + time spent. Replaces the standalone '1d3' screen — that screen's content becomes this column's drill-down instead of a separate nav destination.
4. **Observation logging** (filmed / peer / experienced-teacher hours) — Column: hours logged toward each syllabus minimum, flagged if short.
5. **Stage 1 report** — required for every candidate, filed by the trainer (the report is mandatory; only the tutorial conversation itself is optional). Column: Filed / Not filed.
6. **Stage 2 / Stage 3 tutorials** — Stage 2 booking is filled by both trainee (books slot) and trainer; Stage 3 report is trainer-filed only, by invitation (not universal). Column: Booked (with position) / Not booked / N/A.
7. **CELTA 5 self-assessment & sign-off** — Column: Not started / Candidate signed / Both signed.
8. **Assignments** — Column: N of 4 passed, resubmission flag if used.
9. **FOL error-log entries** (class_error_log) — Column: count logged this course, flagged low if a candidate is under the expected rate.

### Drill-down, not duplication

Clicking any cell opens that item's existing detail view (quiz recap+score, the Stage 2 sheet, the CELTA 5 form, etc.) — those detail screens stay, they're just reached from one table instead of scattered nav entries. What goes away is a *dedicated top-level screen whose only job is a completion list* — that job is now this table's job.

## Going forward

Any new trackable activity (a new quiz, a new logging task) gets **a new column here**, not a new screen. If a drill-down view is genuinely needed, it hangs off this table's cell click, matching the existing detail screens' pattern.
