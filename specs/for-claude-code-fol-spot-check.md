# FOL spot-check view — paste-ready

Extends `specs/for-claude-code-fol-pooled-evidence.md` (Days 2–9 trainer UX). Optional for v1 per that spec, but fully specified here in case there's room to build it.

## What it is

A trainer-facing screen showing, per TP group, how many observations have been logged to the shared `class_error_log` pool so far this FOL cycle (Days 2–9). Purpose is narrow: catch a group that's logged nothing before Day 10 (divergence session), not discover it at Day 12 (marking). It does **not** show what any candidate has claimed or is planning to claim — that's `fol_claims`, a separate table, and stays invisible here.

## Data

Per TP group, derived from `class_error_log` filtered to the current course and FOL cycle:
- Group name, level, learner count (from the volunteer class record)
- Count of grammar-type log rows
- Count of pronunciation-type log rows
- Timestamp of the most recent log row for that group (relative, e.g. "2 hours ago"; "—" if none)
- Status, computed from `grammarCount + pronCount`:
  - `0` → **Empty** (red)
  - `1–2` → **Low** (gold)
  - `3+` → **On track** (green)

## Layout

Header: eyebrow "Focus on the Learner · Days 2–9", title "Error log — spot check", current day / days until divergence session, one-line explainer (see copy in the built screen — do not reword, it's the load-bearing "not a leaderboard" disclaimer).

Table, one row per TP group: group name + level/size, grammar count, pronunciation count, last logged, status pill. Legend row under the table spells out the three status thresholds.

## Access

Trainer-only, scoped to the trainer's own TP group(s) — same visibility rule as the rest of the FOL trainer UX (`for-claude-code-fol-pooled-evidence.md`). No candidate-facing equivalent.

## Reference

Design: `FOL Spot-Check.dc.html`.
