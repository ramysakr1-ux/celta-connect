# Timetable tile system — spec for Claude Code

Written 16 Aug 2026, for Claude Code. Prototype file: `Timetable Drag Prototype.dc.html`. Demonstrates the interaction only — not yet merged into the real admin editor (`Timetable Refresh.dc.html`). Build this behavior into that file.

## Two ways to populate the timetable

1. **Manual entry** — the admin builds it tile-by-tile by hand, same as `Timetable Refresh.dc.html` does today: click a day cell, add a tile, fill in its title/time/trainer/meta.
2. **Drive import** (not designed yet, out of scope for this spec — flagged for a future round: connect a Google Drive file, it populates the same day/tile grid automatically instead of typing each tile by hand).

This spec covers what happens once tiles exist, regardless of how they got there.

## The board

4 weeks stacked vertically, each a 5-column grid (Mon–Fri). Each day cell shows its date number + day-of-week label, then its tiles stacked below (2 tiles per day in the current data, but the layout isn't capped at 2).

## Tiles

Each tile: title, optional Zoom icon (whole-group sessions), optional trainer-initials avatar circle, optional meta line (room, time detail, notes). Left edge has a 3px "spine" in one of three colors that categorizes the session:
- Ink-warm `oklch(30% 0.042 58)` — TP / room-based teaching sessions.
- Gold `oklch(60% 0.11 70)` — whole-group Zoom input sessions.
- Muted `oklch(51% 0.017 70)` — individual/bookable items (consultations, tutorials, late starts).

Tile background/border are the spine color mixed lightly into white (12%/28%), so every tile reads as "tinted by category" even before you touch it.

## Clicking a tile

Opens a detail panel below the grid (not a modal) — title, "Day NN · DAY · time", and 2–4 label/value rows with context appropriate to that session type (TP sessions show Zoom link/candidates/criteria/materials; consultations show format/tutor/booking rules; filmed observations show format/task/hour-counting; closing sessions show attendance/output; input sessions default to trainer/materials/syllabus-strands). Close with an × in the header. Only one detail panel open at a time; clicking another tile swaps its content in place.

**Clicking a day cell itself does nothing** — days are not clickable containers. They only respond to drag-over/drop.

## Dragging a tile

Only tiles marked draggable in this admin context can be dragged (in the prototype, one flagged tile demonstrates it — in the real editor, every tile should be draggable). On drag start, the dragged tile drops to 40% opacity in place.

While dragging, every other day cell live-validates as a drop target and colors itself:
- **Clean move** — ink-warm tint, 15% mixed into white, ink-warm border. Nothing else is affected by the move.
- **Shifts a dependency** — gold/amber tint (`oklch(94.5% 0.065 85)` bg, gold border). Moving here also moves something anchored relative to this tile (e.g. "Assessor meeting note" is pinned to "the day before the visit" and must follow).
- **Blocked** — red tint (15% mixed into white), red border. Cannot be dropped here (e.g. day is already full, or a hard rule prevents it).

The origin day cell is excluded from being a valid target (can't drop a tile back on itself).

A legend below the grid explains the three colors permanently (not just during drag), so admins learn the system passively.

## Dropping a tile

- **Clean drop** — should apply immediately, no confirmation needed (not yet built in the prototype's confirm-always version — build the real editor to skip confirmation for clean moves).
- **Amber drop (dependency shift)** — opens a confirm panel: "Confirm the move" headline, one sentence naming the tile/from-day/to-day, then a highlighted callout naming exactly what else moves and why (e.g. "Assessor meeting note stays anchored to 'the day before the visit' — it moves with it"). Two buttons: Cancel (returns tile to origin) / Confirm move (applies both the dragged tile's move and the dependent shift).
- **Blocked drop** — should not be droppable at all; dragging over a blocked day shows red but dropping does nothing.

## Visual tokens

Fonts: Karla (UI), Newsreader serif (day numbers, panel titles). Background `oklch(94% 0.018 78)`. Neutral card bg `oklch(99.2% 0.005 90)`, neutral border `oklch(88% 0.016 82)`. All styling inline, matching the rest of Connect.

## Known gap

Google Drive import is not designed. If prioritized, it should populate the exact same day/tile data structure this board already renders — the board and its drag/detail/confirm behavior don't change based on how the data arrived.
