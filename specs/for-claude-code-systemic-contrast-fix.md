# Systemic fix: card/page contrast is too low across Connect

Written 22 Aug 2026, for Claude Code. Same root issue spotted on two different pages now
(`/platform/command-center` and `/dashboard/admin` — Course Admin) — likely affects most
of the app, not just these two. Consolidating into one spec rather than filing per-page.

## Problem
Across the app, card/panel surfaces and the page background sit at nearly the same color
value. On Course Admin, the course rows and sidebar barely read as distinct from the page
— everything blends into a single wash of tan. Same complaint, worse, on the command
center (spec already filed: `for-claude-code-command-center-visual-fix.md`).

This is a **token/theme problem, not a per-page styling problem** — check the shared
background and surface/card tokens (likely `--background` and `--card` or equivalent) and
fix at that level so every page inherits the correction, rather than patching pages
individually.

## Fix
Increase the value/lightness difference between page background and card/surface
background — enough that a card's edge is visible without a border, though a subtle
border or shadow as a second cue doesn't hurt. Test against light mode specifically (the
screenshots were light mode) — dark mode may or may not have the same issue, check
separately.

## Where this was seen
- `/platform/command-center` — KPI cards, product cards, account list all same value as
  page background.
- `/dashboard/admin` (Course Admin, Courses list) — course rows, "Centre number set"
  banner, and the sidebar panel all low-contrast against the page. Better than the command
  center (there's a slight value shift), but still hard to read at a glance.

## Suggested check before calling this done
Once the token fix lands, re-check both pages above plus a general pass — Centre Admin,
Trainer, Trainee dashboards — since the same shared tokens likely feed all of them.
