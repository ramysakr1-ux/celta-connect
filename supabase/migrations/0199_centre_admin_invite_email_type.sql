-- for-claude-code-email-delivery-tracking-visible.md follow-up: adds
-- 'centre_admin_invite' as a 25th applicant_emails type, same pattern as
-- 0167. Needed alongside 0198 (centre_admin_invites.email) so the new
-- optional invite-email send can actually record its status.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation',
  'offer', 'rejection', 'rejection_after_interview', 'waiting_list', 'not_this_time', 'place_freed',
  'welcome', 'starts_monday', 'late_enrolment',
  'tutor_added', 'centre_created', 'interview_booked', 'reading_flagged', 'assessor_pack',
  'volunteer_signed_up', 'volunteer_class_starting',
  'referral',
  'workspace_invitation',
  'password_reset', 'sign_in_link', 'centre_delete_code', 'close_out_receipt',
  'centre_admin_invite'
));
