-- "When a place frees, the app notifies the centre and shows who is next"
-- (build-spec.md's Waiting list bullet) -- a staff notification type for
-- this didn't exist yet; 0081 only anticipated submitted/task_returned/
-- interview_completed/stale_no_decision. Idempotent drop-then-recreate by
-- the known deterministic constraint name, matching this project's own
-- established pattern for constraint-altering migrations.
alter table public.admissions_notifications drop constraint if exists admissions_notifications_type_check;
alter table public.admissions_notifications
  add constraint admissions_notifications_type_check
  check (type in ('submitted', 'task_returned', 'interview_completed', 'stale_no_decision', 'place_offered'));
