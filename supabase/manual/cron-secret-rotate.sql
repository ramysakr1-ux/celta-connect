-- Set every cron vault secret to the SAME value as Vercel's CRON_SECRET.
--
-- Why this exists: 31 Aug 2026, the production logs showed eight POSTs to
-- /api/cron/* returning 401 every five minutes. Cause: CRON_SECRET was never
-- created in the Vercel project at all, so every cron route fails its own
-- `if (!secret)` guard before it even compares the header. Migrations 0152,
-- 0158, 0163 and 0178 each say in a comment that CRON_SECRET is "already set
-- in the Vercel project's environment variables" -- that assumption was never
-- true, which is why the reminder and sweep jobs have never run in production.
--
-- The app checks ONE variable (CRON_SECRET) for all nine routes, while the
-- database keeps four separately-named vault entries. So all four must hold
-- the same value.
--
-- HOW TO RUN
--   1. Generate a value and put it in Vercel as CRON_SECRET (Production),
--      then redeploy -- environment variables are only picked up by a new
--      deployment.
--   2. Replace PUT_THE_SAME_VALUE_HERE below with that same value.
--   3. Paste this whole file into the Supabase SQL editor and run it.
--   4. Discard your edited copy -- do not save the real value into the repo.
--
-- Re-runnable: deletes any existing entry of each name before creating it,
-- so rotating later is the same paste with a new value.

do $$
declare
  v_secret text := 'PUT_THE_SAME_VALUE_HERE';
  v_name   text;
begin
  if v_secret = 'PUT_THE_SAME_VALUE_HERE' then
    raise exception 'Replace the placeholder with the real CRON_SECRET first.';
  end if;

  foreach v_name in array array[
    'volunteer_session_reminder_cron_secret',
    'admissions_auto_book_cron_secret',
    'late_push_cron_secret',
    'payments_missed_instalments_cron_secret'
  ] loop
    perform vault.delete_secret(id) from vault.secrets where name = v_name;
    perform vault.create_secret(v_secret, v_name);
  end loop;
end $$;

-- Confirms four rows, and that each decrypts to the same value, without
-- printing the value itself.
select count(*) as vault_entries,
       count(distinct decrypted_secret) as distinct_values
from vault.decrypted_secrets
where name in (
  'volunteer_session_reminder_cron_secret',
  'admissions_auto_book_cron_secret',
  'late_push_cron_secret',
  'payments_missed_instalments_cron_secret'
);
