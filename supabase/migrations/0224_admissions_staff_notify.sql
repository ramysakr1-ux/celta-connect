-- Ramy, 27 Aug 2026: "the right person gets pinged" -- admissions events
-- (application submitted, AI reading completed) were writing to
-- admissions_notifications but nothing ever delivered them (email/push) to
-- staff. New applicant_emails type for the one staff-facing email that
-- didn't already have one -- "reading_flagged" already existed (migration
-- 0113) but was never actually wired to send until now.
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
  'centre_admin_invite',
  'application_submitted'
));
