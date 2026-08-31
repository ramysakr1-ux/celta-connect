-- Rotate the cron shared secret: generates one value, writes it to all four
-- vault entries, and prints it once so it can be pasted into Vercel.
--
-- Why this exists: 31 Aug 2026, production logs showed eight POSTs to
-- /api/cron/* returning 401 every five minutes. Two separate causes, both
-- live at once:
--
--   1. CRON_SECRET did not exist in the Vercel project at all, so every cron
--      route failed its own `if (!secret)` guard before comparing anything.
--      Migrations 0152, 0158, 0163 and 0178 each assert in a comment that it
--      is "already set in the Vercel project's environment variables". That
--      was never true.
--   2. Only THREE of the four vault entries existed. The missing one was
--      volunteer_session_reminder_cron_secret -- the every-five-minutes job,
--      and the one four separate routes depend on.
--
-- So the volunteer session reminders, the reminder emails, the admissions
-- auto-book sweep that clears the 15-minute hold, late push and the
-- missed-instalment check had never run in production.
--
-- IMPORTANT -- do not use vault.delete_secret here. It is not available on
-- this project's Vault version; a first version of this file called it and
-- failed on the first name in the loop, which is how the count came out at
-- three. update-if-present / create-if-absent is the supported shape and is
-- what this uses.
--
-- The app checks ONE variable (CRON_SECRET) for all nine routes, while the
-- database keeps four separately-named vault entries, so all four must hold
-- the same value.
--
-- HOW TO RUN
--   1. Paste this whole file into the Supabase SQL editor and run it. There
--      is nothing to edit -- it generates its own value.
--   2. Copy the single cell it returns.
--   3. Vercel -> Settings -> Environment Variables -> CRON_SECRET
--      (Production), paste as the value, save.
--   4. Redeploy production. Environment variables are only picked up by a
--      NEW deployment -- an existing one keeps the values it was built with.
--   5. Check the logs on the next 5-minute tick: /api/cron/* should read 200.

do $$
declare
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_name   text;
  v_id     uuid;
begin
  foreach v_name in array array[
    'volunteer_session_reminder_cron_secret',
    'admissions_auto_book_cron_secret',
    'late_push_cron_secret',
    'payments_missed_instalments_cron_secret'
  ] loop
    select id into v_id from vault.secrets where name = v_name;
    if v_id is null then
      perform vault.create_secret(v_secret, v_name);
    else
      perform vault.update_secret(v_id, v_secret, v_name);
    end if;
  end loop;
end $$;

-- Copy this into Vercel as CRON_SECRET, then redeploy.
select decrypted_secret as copy_this_into_vercel
from vault.decrypted_secrets
where name = 'volunteer_session_reminder_cron_secret';

-- Sanity check -- expects 4 and 1, and never prints the value itself.
select count(*) as vault_entries,
       count(distinct decrypted_secret) as distinct_values
from vault.decrypted_secrets
where name in (
  'volunteer_session_reminder_cron_secret',
  'admissions_auto_book_cron_secret',
  'late_push_cron_secret',
  'payments_missed_instalments_cron_secret'
);
