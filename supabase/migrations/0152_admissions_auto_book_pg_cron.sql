-- specs/for-claude-code-auto-booked-interview.md: the 15-minute hold on the
-- AI triage "clear" lane (migration 0151) only means something if the
-- sweep that clears it runs often. Piggybacking on the once-a-day
-- admissions-waiting-list route (the Vercel Hobby plan this project is on
-- caps cron jobs at 2/day) made the hold a floor of "up to a day," not 15
-- minutes -- a real gap against a lane whose whole purpose is a fast,
-- trustworthy auto-send, not a steady state to leave alone.
--
-- Fix: a Supabase pg_cron job, running inside the database itself and
-- independent of Vercel's cron limits, calls the dedicated
-- /api/cron/admissions-auto-book route every 5 minutes via pg_net.
--
-- The route's CRON_SECRET must never live in a file that gets committed to
-- git, so it is not written here. Before running this migration, store it
-- once in Supabase Vault by running this in the SQL Editor -- with your
-- own real secret substituted in, matching the CRON_SECRET already set in
-- the Vercel project's environment variables -- and then discard that
-- command rather than saving it anywhere:
--
--   select vault.create_secret('<your real CRON_SECRET value>', 'admissions_auto_book_cron_secret');
--
-- Re-running that command (e.g. after rotating the secret) requires
-- deleting the old one first: select vault.delete_secret(id) from
-- vault.secrets where name = 'admissions_auto_book_cron_secret'; then
-- create_secret again with the new value.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'admissions-auto-book',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://celtaconnect.com/api/cron/admissions-auto-book',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'admissions_auto_book_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
