-- Ramy, 23 Aug 2026: volunteers get an email, not a push, for the
-- day-before class reminder (distinct from the existing 30-minutes-before
-- push, migration 0158, which stays as-is). Both reminders share
-- volunteer_session_reminders_sent for idempotency, so it needs a channel
-- column and a unique constraint that includes it -- otherwise the push
-- cron's own "already reminded" check would wrongly skip a volunteer the
-- email cron already reminded for the same event, and vice versa.

alter table public.volunteer_session_reminders_sent add column channel text not null default 'push' check (channel in ('push', 'email'));

alter table public.volunteer_session_reminders_sent drop constraint if exists volunteer_session_reminders_sent_volunteer_student_id_timetable_event_id_key;
alter table public.volunteer_session_reminders_sent add constraint volunteer_session_reminders_sent_volunteer_event_channel_key unique (volunteer_student_id, timetable_event_id, channel);

-- 26th applicant_emails type, same pattern as 0199.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation',
  'offer', 'rejection', 'rejection_after_interview', 'waiting_list', 'not_this_time', 'place_freed',
  'welcome', 'starts_monday', 'late_enrolment',
  'tutor_added', 'centre_created', 'interview_booked', 'reading_flagged', 'assessor_pack',
  'volunteer_signed_up', 'volunteer_class_starting', 'volunteer_session_reminder',
  'referral',
  'workspace_invitation',
  'password_reset', 'sign_in_link', 'centre_delete_code', 'close_out_receipt',
  'centre_admin_invite'
));

-- Once daily, evening before (17:00 UTC) -- reuses the same vault secret
-- migration 0158 already asked you to create (volunteer_session_reminder_
-- cron_secret); no new vault.create_secret call needed, this route checks
-- the same CRON_SECRET value.
select cron.schedule(
  'volunteer-session-reminder-email',
  '0 17 * * *',
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
