-- twenty-decisions.md / build-spec.md: "only three [push kinds] ever leave
-- the app -- a cancellation, a room change, or something already late."
-- Cancellation and the volunteer reminder are live; this is the third,
-- confirmed with Ramy 2026-08-20: "late is past deadline for everybody,
-- trainees and trainers alike."
--
-- Ramy, 2026-08-20: "this rule will apply to everything that has a
-- deadline on the timetable or set by the MCT, regardless of the role
-- they are playing" -- so both of an assignment's deadlines count, not
-- just the first one. Two separate columns, not one reused flag: a
-- first-submission push and a later resubmission push are genuinely
-- different deadlines on the same row, and one flag would silently
-- suppress the second push forever once the first had already fired.
--
-- First-submission side: same definition src/lib/at-risk.ts already uses
-- (`due_date && due_date < today && !first_submitted_at`), reused here
-- rather than inventing a second "late" rule for the same fact.
alter table public.assignments add column first_late_push_sent_at timestamptz;

-- Resubmission side: the due date isn't a column on assignments at all --
-- it's a course_timetable_events row (type='resubmission_due', linked_
-- assignment_type), the same source course-progress.ts's own "at risk"
-- computation already reads. Late once that event's date has passed and
-- resubmission_status is still not_submitted on an assignment that
-- actually owes one (first_status='resubmission_required').
alter table public.assignments add column resubmission_late_push_sent_at timestamptz;

-- Trainer side: the MCT's provisional_grades_due_at (migration 0127, "the
-- MCT enters the provisional grades in Appian") has passed while any
-- trainee on the course still has no provisional_grade recorded. One push
-- per course, not per trainee -- entering grades is the MCT's one job, not
-- a per-candidate task.
alter table public.courses add column provisional_grades_late_push_sent_at timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Before running this migration, store the route's secret once in
-- Supabase Vault -- with your own real value substituted in, matching
-- CRON_SECRET already set in the Vercel project's environment variables --
-- then discard the command rather than saving it anywhere:
--
--   select vault.create_secret('<your real CRON_SECRET value>', 'late_push_cron_secret');
--
-- Re-running (e.g. after rotating the secret) requires deleting the old
-- one first: select vault.delete_secret(id) from vault.secrets where name
-- = 'late_push_cron_secret'; then create_secret again.
--
-- Daily, not every-5-minutes like the other cron pushes -- both triggers
-- here are date-level (due_date, provisional_grades_due_at), not
-- minute-level, so there's no reason to sweep more often.
select cron.schedule(
  'late-push',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://celtaconnect.com/api/cron/late-push',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'late_push_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
