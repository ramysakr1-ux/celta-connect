# Timetable seed data incomplete — Week 3 only shows TP4/TP5

Written 23 Aug 2026, for Claude Code. Confirmed against a live screenshot of the trainee
Timetable view (`/portfolio/.../timetable`, Week 3, 17-23 August).

## What's there vs. what should be there
The screen itself is built correctly: header, live-now bar slot, legend (Whole group/Zoom,
Group room, Admin & deadlines, Individual, Lunch), the 9-time-band grid, week picker,
footnote — all matches `for-claude-code-timetable-view.md`. Only TP4 (Tue) and TP5 (Sun)
render; every other day/time-band cell in Week 3 is empty.

Per spec, a populated week should show a realistic mix across all 5 categories per day —
whole-group Zoom input sessions, group-room TP/feedback/planning, admin & deadline items,
individual/bookable consultation slots, and lunch — not just two TP tiles.

## Ask
Check whether Week 3's seed/demo data is genuinely this sparse, or only two sessions were
ever added for this week. If it's a seeding gap, populate Week 3 (and spot-check the other
3 weeks) with a realistic full week's worth of tiles across all 5 categories, matching the
color/glass-card system already spec'd. This is a data-completeness check, not a rebuild —
the rendering and interaction logic appear to already be working correctly for the two
tiles that do have data (card styling, camera icon, etc. — worth confirming those also
match spec exactly once more tiles exist to check against).
