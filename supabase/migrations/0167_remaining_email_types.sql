-- for-claude-code-email-delivery-tracking.md's remaining untracked sends,
-- now routed through sendApplicantEmail: sign-in links, password resets,
-- the centre-delete confirmation code, and the course close-out receipt
-- request. assessor_pack (already an allowed type since 0113, never
-- actually used until now) covers sendAssessorInviteEmail -- no new value
-- needed for that one.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation',
  'offer', 'rejection', 'rejection_after_interview', 'waiting_list', 'not_this_time', 'place_freed',
  'welcome', 'starts_monday', 'late_enrolment',
  'tutor_added', 'centre_created', 'interview_booked', 'reading_flagged', 'assessor_pack',
  'volunteer_signed_up', 'volunteer_class_starting',
  'referral',
  'workspace_invitation',
  'password_reset', 'sign_in_link', 'centre_delete_code', 'close_out_receipt'
));
