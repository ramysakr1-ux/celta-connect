-- Ramy, 25 Aug 2026: "the thirty minute push reminder is an email... should
-- only be sent to ones who said they would come. The ones who declined day
-- before will not get it" -- then, moments later: "let's leave the enable
-- notifications" -- so the existing 30-minutes-before PUSH
-- (volunteer-session-reminder-cron.ts) stays exactly as it is; this adds an
-- EMAIL version of the same nudge alongside it, so volunteers who never
-- turned push on still get reminded. New channel value keeps this fully
-- independent of the existing 'push' and 'email' (day-before) rows in
-- volunteer_session_reminders_sent -- same idempotency table, three
-- channels now, none of them block each other.
do $$
declare
  old_name text;
begin
  select conname into old_name
  from pg_constraint
  where conrelid = 'public.volunteer_session_reminders_sent'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%channel%';
  if old_name is not null then
    execute format('alter table public.volunteer_session_reminders_sent drop constraint %I', old_name);
  end if;
end $$;

alter table public.volunteer_session_reminders_sent add constraint volunteer_session_reminders_sent_channel_check check (channel in ('push', 'email', 'email_30min'));

-- 27th applicant_emails type, same pattern as 0199/0201.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation',
  'offer', 'rejection', 'rejection_after_interview', 'waiting_list', 'not_this_time', 'place_freed',
  'welcome', 'starts_monday', 'late_enrolment',
  'tutor_added', 'centre_created', 'interview_booked', 'reading_flagged', 'assessor_pack',
  'volunteer_signed_up', 'volunteer_class_starting', 'volunteer_session_reminder', 'volunteer_session_reminder_30min',
  'referral',
  'workspace_invitation',
  'password_reset', 'sign_in_link', 'centre_delete_code', 'close_out_receipt',
  'centre_admin_invite'
));

-- "if they don't wanna be notified in the email, they can just disable it
-- in the email itself" -- one opt-out flag covers both class-reminder
-- emails (day-before and 30-minutes-before); push keeps its own separate
-- on/off toggle in the browser, untouched by this.
alter table public.volunteer_students add column if not exists reminders_opted_out boolean not null default false;

-- Every 5 minutes, same sweep cadence as the push cron (migration 0158) so
-- the two land in the same window -- reuses the push cron's vault secret,
-- no new one needed.
select cron.schedule(
  'volunteer-session-reminder-30min-email',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://celtaconnect.com/api/cron/volunteer-session-reminder-30min-email',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'volunteer_session_reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
