-- connect-spec-corrections-for-claude-code.md item 6 (updated 2026-08-21):
-- the TP7/8 material pool is centre/course-optional, not universal -- some
-- centres let candidates keep using the main coursebook for TP7/8. Default
-- true: the pool (migration 0180) already shipped and is live on existing
-- courses, so flipping the default to false would silently pull it out
-- from under anyone already using it. New courses inherit true too and an
-- admin turns it off per course, same as delivery_mode's "asked once, read
-- everywhere" pattern (migration 0057).
alter table public.courses
  add column tp_material_pool_enabled boolean not null default true;
