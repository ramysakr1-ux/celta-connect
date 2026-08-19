-- src/app/api/cron/payments-missed-instalments/route.ts (runMissedInstalmentsCron,
-- src/lib/payments-cron.ts) was built and correctly flips overdue "pending"
-- payments to "missed" and writes payment_notifications -- but nothing ever
-- called it. Not in vercel.json (that's already at the Hobby-plan 2-cron/day
-- cap with course-close-out-wipe and admissions-waiting-list) and never given
-- a pg_cron job like admissions-auto-book (0152) and volunteer-session-reminder
-- (0158) were. Same pattern as those two: a daily sweep is enough since the
-- check is date-based (due_date < today), not time-of-day sensitive.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Before running this migration, store the route's secret once in Supabase
-- Vault -- with your own real value substituted in, matching CRON_SECRET
-- already set in the Vercel project's environment variables -- then discard
-- the command rather than saving it anywhere:
--
--   select vault.create_secret('<your real CRON_SECRET value>', 'payments_missed_instalments_cron_secret');
--
-- Re-running (e.g. after rotating the secret) requires deleting the old one
-- first: select vault.delete_secret(id) from vault.secrets where name =
-- 'payments_missed_instalments_cron_secret'; then create_secret again.
select cron.schedule(
  'payments-missed-instalments',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://celtaconnect.com/api/cron/payments-missed-instalments',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'payments_missed_instalments_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
