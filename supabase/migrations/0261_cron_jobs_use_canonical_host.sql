-- Point every pg_cron HTTP job at the canonical host.
--
-- Found 31 Aug 2026. Every one of these jobs called
-- https://celtaconnect.com/... -- the apex. Vercel answers the apex with a
-- 308 to https://www.celtaconnect.com/..., and an Authorization header does
-- not survive a redirect to a different host. pg_net follows the redirect and
-- drops the bearer token, so the route saw an unauthenticated request and
-- returned 401.
--
-- That means these jobs could never have worked, whatever CRON_SECRET held.
-- It sat underneath two other faults found the same day -- CRON_SECRET was
-- missing from the Vercel project entirely, and only three of the four vault
-- entries existed -- and all three produce an identical 401, which is why
-- fixing them one at a time looked like no progress at all.
--
-- Affected: admissions-auto-book (the 5-minute sweep that clears the
-- 15-minute interview hold), volunteer-session-reminder, both volunteer
-- reminder email jobs, late-push and payments-missed-instalments.
--
-- Rewrites the existing job definitions in place rather than re-declaring
-- each one, so it stays correct if a schedule or body is changed later, and
-- it is safe to re-run: after the first pass nothing matches the filter.
--
-- Note for any new cron job: call the canonical host directly. A redirect
-- silently strips the credential, and the only symptom is a 401 that looks
-- exactly like a wrong secret.

do $$
declare
  j record;
begin
  for j in
    select jobname, schedule, command
    from cron.job
    where command like '%https://celtaconnect.com/%'
  loop
    perform cron.schedule(
      j.jobname,
      j.schedule,
      replace(j.command, 'https://celtaconnect.com/', 'https://www.celtaconnect.com/')
    );
  end loop;
end $$;
