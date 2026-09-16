# Timetable — DragBoard (editing) and the glass-card grid (viewing) are two different tools, not competing redesigns

Resolves the apparent contradiction between `for-claude-code-timetable-page-priority.md` and `for-claude-code-timetable-dragboard-fidelity.md`.

## The actual distinction

**DragBoard** (what's live today on `/trainer/timetable`) is a course **setup/editing** tool — drag a tile from one day to another to reschedule, click to open a detail panel and edit an event's fields. That's the right interaction model for building and adjusting the timetable.

**The glass-card design** (`for-claude-code-timetable-view.md` — blur cards, 5-category color meaning, live-now status bar, week picker, join button) was written for a different job: **looking at** the timetable — checking what's on today, seeing what's live right now, joining a session. A trainer (and a trainee) needs this constantly, separate from the occasional task of editing the schedule.

DragBoard was never meant to replace that view — it replaced an earlier **editable** time-band grid (`timetable-grid.tsx`, per its own code comment), which is a different thing from the read-only view spec entirely. The two specs weren't actually in conflict; they were describing two different screens that got collapsed into one.

## What to build

Two things exist side by side, not one replacing the other:

1. **Keep DragBoard as the editing tool**, exactly as designed today — drag-to-reschedule, click-to-edit-detail. No visual rebuild needed here.
2. **Build the glass-card view as its own read-only mode** — the actual place a trainer (and trainee) looks to see today's schedule, what's live, and to join a session. This is what `for-claude-code-timetable-view.md` already fully specs (glass cards, category colors + legend, live-now bar, Mine/Everything toggle, week picker, working Zoom join with live/dormant states).

## Where each one lives

Given `for-claude-code-timetable-page-priority.md`'s reorder ask (the actual timetable should be the first thing a trainer sees, setup tools deprioritized): the **glass-card view** should be what a trainer lands on first when they open Timetable — the day-to-day glance/join screen. DragBoard (editing) becomes a secondary mode/tab from there — "Edit timetable" or similar — for the setup work, alongside the other MCT-only setup tools (time bands, add event, lock/unlock) already covered in that spec.

This also resolves the missing-Zoom-join gap flagged in the fidelity spec: the join functionality was never missing from the *design*, it's missing because the view that was supposed to carry it was never built — DragBoard was never meant to be where you join a session from.

## Not needed

No rebuild of DragBoard's own visuals into glass cards — it stays as the plain drag-and-drop editor it already is. The glass-card treatment is for the new view screen only.
