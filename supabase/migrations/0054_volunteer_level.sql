-- build-spec.md item 16 (Volunteers): "A volunteer belongs to a class at a
-- specific level (Elementary, Upper-Intermediate, etc.), not merely to the
-- course. Candidates must teach at a range of levels, so the class is what
-- a TP is scheduled against." Scoped narrowly, per Ramy's explicit
-- decision (2026-08-08) to defer the full cross-course hours-bank/Zoom/
-- certificate system and take only the small, contained pieces for now:
-- this column, plus the volunteer's own progress display fix (code-only,
-- no schema).
--
-- Free text, not a foreign key -- same pattern as observations.level and
-- tp_lessons.level, both already plain text elsewhere in this schema. The
-- app populates the picker from the shared CEFR_LEVELS list
-- (src/lib/levels.ts) for consistency, same as those other two fields.

alter table public.volunteer_students
  add column level text;
