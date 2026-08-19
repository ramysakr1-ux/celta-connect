-- specs/course-modes.md §2 (Handbook 8.1.2), mixed-mode delivery piece 1 of
-- the remaining two on delivery-mode.ts's own "not yet built" list ("the
-- hours counter should split in two", "the timetable should enforce this,
-- not just warn"). Both need to know which mode a given TP round is in --
-- nothing in the timetable/rotation model tracked that at all before this.
--
-- Same shape as migration 0126's observations.mode: nullable, only ever
-- asked/shown on a mixed-mode course, set manually per TP round (Ramy,
-- 2026-08-19 -- automatic-by-position was the alternative, manual chosen
-- for flexibility since a course's f2f/online split need not be
-- contiguous). Deliberately not restricted to type='tp' at the database
-- level -- the UI only ever offers it there, but a future non-tp use
-- shouldn't need a new migration.
alter table public.course_timetable_events add column mode text check (mode in ('f2f', 'online'));

comment on column public.course_timetable_events.mode is
  'Which mode this TP round is in. Only meaningful (and only asked) on a mixed-mode course; null otherwise.';
