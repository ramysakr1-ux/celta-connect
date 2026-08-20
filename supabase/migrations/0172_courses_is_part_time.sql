-- for-claude-code-concurrent-course-checks.md: the Handbook 2.4 rule (a
-- tutor blocked from two concurrent full-time courses, full-time+part-time
-- allowed) turns on whether a course is full-time or part-time -- a fact
-- that, until now, existed only as a one-time "shape" choice on the
-- timetable-skeleton generation form and left no lasting record on the
-- course itself (generateTimetableSkeleton only ever wrote
-- course_timetable_events rows, never touched courses). Persisted here so
-- the concurrent-course check (and the course switcher's FT/PT tag,
-- for-claude-code-course-switcher.md) has something real to read.
alter table public.courses add column is_part_time boolean not null default false;
