-- for-claude-code-email-delivery-tracking.md: the workspace invitation
-- email (sendJoinLinkEmail, roster-actions.ts) was sent via a raw
-- resend.emails.send() call, completely outside applicant_emails --
-- untracked, no bounce gate, no delivery state -- despite being exactly
-- the case that spec calls the highest-stakes one ("a person with no way
-- into the course they've paid for"). Routed through sendApplicantEmail
-- now, so it gets the same tracking/two-strike-bounce-gate every other
-- email already has. applicant_id stays null -- a join invite (trainee or
-- trainer) often has no applicant row at all, same as the six existing
-- staff-facing types.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation',
  'offer', 'rejection', 'rejection_after_interview', 'waiting_list', 'not_this_time', 'place_freed',
  'welcome', 'starts_monday', 'late_enrolment',
  'tutor_added', 'centre_created', 'interview_booked', 'reading_flagged', 'assessor_pack',
  'volunteer_signed_up', 'volunteer_class_starting',
  'referral',
  'workspace_invitation'
));
