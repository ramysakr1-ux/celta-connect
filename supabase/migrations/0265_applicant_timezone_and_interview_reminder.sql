-- Applicants apply from anywhere; interviews were told in nobody's timezone.
--
-- Ramy, 3 Sep 2026: "they do it from different countries, different time
-- zones... so we need a way to track down their time zone... and then when
-- the interview appointment is sent, then there is reference to the time
-- zone. The centre's own time zone and the applicant's time zone. Also, be
-- good to send them a one hour reminder before the interview."
--
-- centers.time_zone has been real NOT NULL data since 26 Aug 2026, but the
-- applicant side had nothing at all: an interview slot is wall-clock time at
-- the centre, and every email said it as a bare "10:00" with no zone label,
-- formatted in whatever zone the server happened to run in. An applicant in
-- Lima and one in Seoul got the same string.

alter table public.applicants
  add column if not exists time_zone text;

comment on column public.applicants.time_zone is
  'IANA zone the applicant chose on the application form, e.g. Europe/Istanbul. Nullable: every applicant who applied before 3 Sep 2026 has none, and interview times fall back to being stated in the centre''s zone only rather than inventing a second one.';

-- What stops the reminder becoming a nuisance. Without it the sweep below
-- would re-send on every run for the whole hour before an interview.
alter table public.interview_slots
  add column if not exists reminder_sent_at timestamptz;

comment on column public.interview_slots.reminder_sent_at is
  'When the one-hour-before reminder was sent for this booked slot. Read by runInterviewReminderCron() so a reminder goes once per booking; cleared when the slot is freed, so a rebooked or rescheduled slot is reminded again.';

-- Freeing a slot must clear the stamp, or a rescheduled interview never gets
-- its reminder. Doing it in the database rather than in each caller: a slot
-- is freed from the applicant's own reschedule, from staff clearing it, and
-- from the demo journey reset, and a rule this easy to forget belongs where
-- all three meet.
create or replace function public.clear_interview_reminder_on_unbook() returns trigger as $$
begin
  if new.booked_applicant_id is distinct from old.booked_applicant_id then
    new.reminder_sent_at := null;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists clear_interview_reminder on public.interview_slots;
create trigger clear_interview_reminder
  before update on public.interview_slots
  for each row execute function public.clear_interview_reminder_on_unbook();

-- Rescheduling, once. Ramy, 3 Sep 2026 chose self-service, one change only,
-- with a cutoff: "is there a rescheduling option?" There was none -- the only
-- way a slot got freed was a staff member clearing it by hand.
--
-- A stamp rather than a counter, because the rule is "once" and a timestamp
-- also answers "when did they move it", which is the question staff ask.
alter table public.applicants
  add column if not exists interview_rescheduled_at timestamptz;

comment on column public.applicants.interview_rescheduled_at is
  'When this applicant moved their own interview. Set once: the reschedule link is withdrawn afterwards and they are asked to contact the centre. Null means they have not used it.';

-- applicant_emails.type is a CHECK constraint, not free text, so the reminder
-- cannot be logged -- and therefore cannot be sent -- until it is listed.
-- Same shape as migration 0225, which added the last four.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation', 'interview_reminder', 'interview_rescheduled',
  'offer', 'rejection', 'rejection_after_interview', 'waiting_list', 'not_this_time', 'place_freed',
  'welcome', 'starts_monday', 'late_enrolment',
  'tutor_added', 'centre_created', 'interview_booked', 'reading_flagged', 'assessor_pack',
  'volunteer_signed_up', 'volunteer_class_starting', 'volunteer_session_reminder', 'volunteer_session_reminder_30min',
  'referral',
  'workspace_invitation',
  'password_reset', 'sign_in_link', 'centre_delete_code', 'close_out_receipt',
  'centre_admin_invite',
  'application_submitted',
  'interview_completed', 'place_offered', 'referral_request_notify', 'no_interview_slots'
));

-- The sweep. Every 5 minutes, because a one-hour reminder wants finer
-- resolution than the daily jobs -- same cadence and same shape as
-- volunteer_30min_email_reminder (migration 0214).
--
-- pg_cron rather than a third entry in vercel.json: Vercel Cron on the Hobby
-- plan allows two jobs and both are already taken (course-close-out-wipe,
-- admissions-waiting-list).
--
-- The vault entry is copied from an existing one so the shared secret never
-- has to be typed, pasted or carried anywhere.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'interview_reminder_cron_secret') then
    perform vault.create_secret(
      (select decrypted_secret from vault.decrypted_secrets where name = 'volunteer_session_reminder_cron_secret'),
      'interview_reminder_cron_secret'
    );
  end if;
end $$;

-- www, not the apex: the apex 308-redirects and an Authorization header does
-- not survive a redirect, which is one of the three faults that had every
-- cron returning 401 through late August.
select cron.unschedule('interview-reminder')
where exists (select 1 from cron.job where jobname = 'interview-reminder');

select cron.schedule(
  'interview-reminder',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.celtaconnect.com/api/cron/interview-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'interview_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
