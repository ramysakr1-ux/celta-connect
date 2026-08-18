-- for-claude-code-announcements.md: the volunteer "starts in 30 minutes"
-- push. Idempotency table first -- a 5-minute pg_cron sweep (same pattern
-- as migration 0152's admissions-auto-book) needs to know which
-- volunteer+event pairs it has already reminded, or a volunteer would get
-- the same push repeated every sweep until the event starts.
create table public.volunteer_session_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  volunteer_student_id uuid not null references public.volunteer_students (id) on delete cascade,
  timetable_event_id uuid not null references public.course_timetable_events (id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (volunteer_student_id, timetable_event_id)
);

alter table public.volunteer_session_reminders_sent enable row level security;
-- No policies -- written only by the cron route via the admin client.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Before running this migration, store the route's secret once in
-- Supabase Vault -- with your own real value substituted in, matching
-- CRON_SECRET already set in the Vercel project's environment variables --
-- then discard the command rather than saving it anywhere:
--
--   select vault.create_secret('<your real CRON_SECRET value>', 'volunteer_session_reminder_cron_secret');
--
-- Re-running (e.g. after rotating the secret) requires deleting the old
-- one first: select vault.delete_secret(id) from vault.secrets where name
-- = 'volunteer_session_reminder_cron_secret'; then create_secret again.
select cron.schedule(
  'volunteer-session-reminder',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://celtaconnect.com/api/cron/volunteer-session-reminder',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'volunteer_session_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
