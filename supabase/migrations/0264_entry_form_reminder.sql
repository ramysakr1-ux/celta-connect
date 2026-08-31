-- Make the entry form deadline actually chase someone.
--
-- Ramy, 31 Aug 2026, walking the Course Admin journey: "overdue two weeks
-- before the course starts. Okay. Good. A reminder. Does it push anywhere?"
--
-- It did not. computeEntryFormDeadline() derives the date from Handbook 4.1
-- -- 28 days before start for online, 14 for everything else, since mode is
-- defined by TP location -- and the course page turned red once it passed.
-- That was the entire mechanism. Nobody was emailed, nobody was pushed, and
-- if no one opened that page the deadline went by in silence. A Cambridge
-- deadline with no teeth.
--
-- The column below is what stops the fix becoming a nuisance: without it a
-- daily sweep would push every day for as long as the form stayed unsent,
-- which is how people learn to ignore notifications.

alter table public.courses
  add column if not exists entry_form_reminder_sent_at timestamptz;

comment on column public.courses.entry_form_reminder_sent_at is
  'When the entry form reminder was last pushed for this course. Read by runEntryFormReminderCron() to send a warning three days before the deadline, once on the day it passes, and weekly after that -- rather than daily forever.';

-- The daily sweep. Deliberately pg_cron rather than a third entry in
-- vercel.json: Vercel Cron on the Hobby plan allows two jobs and both are
-- already taken (course-close-out-wipe, admissions-waiting-list).
--
-- 06:00 UTC so it lands in the working morning for European centres and does
-- not arrive overnight; the sweep decides "today" per centre timezone anyway,
-- so the hour here only affects when the push arrives, not which courses it
-- picks.
--
-- The vault entry is created by copying an existing one, so the shared secret
-- never has to be typed, pasted or carried anywhere -- which, after the
-- evening this was written, is a lesson worth encoding in the migration.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'entry_form_reminder_cron_secret') then
    perform vault.create_secret(
      (select decrypted_secret from vault.decrypted_secrets where name = 'volunteer_session_reminder_cron_secret'),
      'entry_form_reminder_cron_secret'
    );
  end if;
end $$;

-- www, not the apex. The apex 308-redirects and an Authorization header does
-- not survive a redirect to a different host -- the bug that had every cron in
-- this project silently 401ing until 31 Aug 2026.
select cron.schedule(
  'entry-form-reminder',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://www.celtaconnect.com/api/cron/entry-form-reminder',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'entry_form_reminder_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
