# Trainer hub -- navigation rules

Two rules decide where a screen lives. Both are Ramy's, from the
"unpacking the kitchen sink" plan (4-5 Sep 2026) and the one-room-one-door
rule (31 Aug 2026).

## Tab or sub-page?

A **tab** is something a tutor returns to during a course: Today, Roster,
Timetable, Volunteers, Teaching Practice, Assessor (MCT), Resource hub,
Trainer-in-Training (when the course has one and you are allowed in),
Grade form.

A **sub-page** is occasional, and is reached from the tab that owns it --
never from the tab row. Every tab lists its sub-pages in an "Also under ..."
pill row (`also-under.tsx`) directly under its header, and nowhere else on
that tab:

- Today: Announcements (MCT), Concerns, Support access (MCT)
- Roster: Error log spot check
- Timetable: Share session materials
- Teaching Practice: TP points library, Pre-course tasks, Observation
  tasks, Observation hours, Day-one activities (Rotation has its own card)
- Resource hub: its sections rail is the row -- Assignment briefs and
  Marking guidance live here since 5 Sep 2026

A tab with no sub-pages shows no row. Do not fill it with reassurance.

## One room, one door

One room per view, one door per thing. A page listed in an "Also under"
row is not also a header button or an inline link on the same tab. If two
doors to the same place exist, remove one -- the confusion between Course
Admin and Centre Management came from exactly that.

## Today's banner

Only Cambridge-compliance impossibilities: what the course cannot satisfy
as planned, which working through the queue would not fix. Tasks belong in
"Needs you". The seven checks live in `src/lib/course-compliance.ts` and
`src/lib/assessor-day.ts`. Absent is the normal state.
