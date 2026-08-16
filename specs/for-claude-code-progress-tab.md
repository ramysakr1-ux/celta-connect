# Progress tab — CELTA 5 self-assessment, sign-off, observation hours

Written 15 Aug 2026, for Claude Code.

## Decision
Keep this as its **own 6th tab**, not folded into "My teaching" and not link-only. Tab order: Today, Timetable, My teaching, Assignments, Resources, **Progress**.

Reasoning: this covers a required certification step (Cambridge sign-off, observation-hours logging) that a trainee must reliably find — burying it behind "waiting on you" links on Today risks it being missed until it's overdue, and folding it into My teaching (the TP lesson record) mixes two different mental models on one screen. A persistent tab keeps its state (done / not done, hours logged) glanceable at all times.

## What lives here
- CELTA 5 self-assessment form and sign-off status.
- Observation-hours log: peer observation, filmed observation, and observation of experienced teachers (with the video-hours cap tracked separately from live hours), each with a running total against the syllabus minimum.
- Nothing renamed "Grades" or "CELTA 5" on the tab label — call the tab **"Progress"**, broad enough to cover self-assessment, sign-off, and hours without promising a grades view it doesn't have.

## Resolved 16 Aug — Progress tab does house Stage 1/2/3
Confirmed against `build-spec.md`'s verbatim Stage 1/2/3 rules: Stage 1 (report mandatory, tutorial optional), Stage 2 (both mandatory), Stage 3 (report mandatory only when triggered — not-to-standard at Stage 2, above-standard-but-slipping, or a failed written assignment; tutorial optional even when triggered). The Progress tab is the home for all three, sourced from the unified Standing table's rollup, matching the existing per-candidate trigger logic already specced — no new decision needed, this was already written elsewhere and just not connected to this tab.
