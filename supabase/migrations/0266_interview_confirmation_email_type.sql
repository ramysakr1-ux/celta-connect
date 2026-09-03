-- The applicant's own interview confirmation. Booking an interview emailed
-- the interviewer and the admissions holder and the applicant nothing at all;
-- the confirmation is where they are told, once and calmly, that they can
-- move it once up to 24 hours before. Ramy, 3 Sep 2026: "that should be done
-- earlier... be good for them to know that they can change it once, but they
-- have a time frame."
--
-- applicant_emails.type is a CHECK constraint, so it must be listed here or
-- the send cannot be logged. Same list as 0265 plus one entry.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation', 'interview_reminder', 'interview_rescheduled', 'interview_confirmation',
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
