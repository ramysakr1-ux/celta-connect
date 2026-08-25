-- Ramy, 25 Aug 2026: the day-before volunteer email used to fire once a
-- day at a fixed clock time (17:00 UTC, migration 0201) for anything on
-- "tomorrow"'s calendar date -- actual lead time swung 15-33 hours
-- depending on the class's own start time, and said nothing about time
-- zone. Now computed per class, 20 hours before its own start time
-- (src/lib/volunteer-session-email-reminder-cron.ts) -- deliberately not
-- 24, since a course teaching daily at the same time would otherwise have
-- "tomorrow's" reminder land right at today's class. Needs a much tighter
-- sweep than once a day to catch that per-class window; reuses the push
-- cron's existing vault secret, no new one needed.
select cron.unschedule('volunteer-session-reminder-email');

select cron.schedule(
  'volunteer-session-reminder-email',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://celtaconnect.com/api/cron/volunteer-session-reminder-email',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'volunteer_session_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
