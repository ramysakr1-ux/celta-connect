-- specs/build-spec.md §14, "Sharing between branches / Candidate referral":
-- "One person holding admissions at both branches refers in a single
-- action. Where nobody spans the two, it becomes a request the receiving
-- branch accepts." referApplicant()/referApplicantAction (existing) already
-- cover the single-action case. This adds the request lane for when the
-- viewer doesn't hold admissions at the destination branch: they can still
-- ask, and the receiving branch decides.
--
-- Deliberately its own table rather than overloading applicants.stage --
-- a pending request is not yet a referral (nothing has moved, no new
-- applicant row exists) and may be declined and never happen at all.

create table public.branch_referral_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants (id) on delete cascade,
  from_center_id uuid not null references public.centers (id) on delete cascade,
  to_center_id uuid not null references public.centers (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decline_reason text,
  -- Set on accept -- the new applicant row referApplicant() created at the
  -- destination branch, same as referred_from_applicant_id on that row.
  resulting_applicant_id uuid references public.applicants (id) on delete set null,
  -- One request per applicant, ever. A declined request doesn't get retried
  -- silently -- a genuinely different ask (different branch, second look)
  -- is a deliberate follow-up, not something to guess a re-request UI for.
  unique (applicant_id)
);

create index branch_referral_requests_to_center_idx on public.branch_referral_requests (to_center_id, status);
create index branch_referral_requests_from_center_idx on public.branch_referral_requests (from_center_id);

alter table public.branch_referral_requests enable row level security;

-- Same shape as admissions_notifications' own policy: current_center_id()
-- already resolves to whichever branch the viewer is actively filtered to
-- (home centre, or an explicit active_center_id backed by a real
-- centre_roles grant) -- covers a multi-branch admin reading requests from
-- either side of one just by switching their filter. Writes are admin-
-- client only (requestBranchReferral/acceptBranchReferralRequest/
-- declineBranchReferralRequest in src/lib/admissions-referral.ts), same
-- pattern as referApplicant itself -- no INSERT/UPDATE policy needed here.
create policy "branch_referral_requests: admissions staff read their centre's"
on public.branch_referral_requests for select to authenticated
using (
  public.can_handle_admissions()
  and public.current_center_id() in (from_center_id, to_center_id)
);

-- New notification type for the receiving branch -- "the area owner is
-- notified... a statement, so they are not told by a candidate." Reuses the
-- existing admissions_notifications feed rather than a new mechanism, same
-- as every prior addition to this constraint.
alter table public.admissions_notifications drop constraint if exists admissions_notifications_type_check;
alter table public.admissions_notifications
  add constraint admissions_notifications_type_check
  check (type in ('submitted', 'task_returned', 'interview_completed', 'stale_no_decision', 'place_offered', 'clear_problems', 'no_interview_slots', 'referral_request'));

-- New candidate-facing email type -- "the candidate gets one email that
-- asks them for nothing and never uses the words referred or transferred."
-- Fires from the SAME successful referApplicant() call whether it was
-- reached directly (referApplicantAction) or via an accepted request
-- (acceptReferralRequestAction), so both paths carry it identically.
alter table public.applicant_emails drop constraint if exists applicant_emails_type_check;
alter table public.applicant_emails add constraint applicant_emails_type_check check (type in (
  'acknowledgement', 'task_waiting', 'interview_invitation',
  'offer', 'rejection', 'rejection_after_interview', 'waiting_list', 'not_this_time', 'place_freed',
  'welcome', 'starts_monday', 'late_enrolment',
  'tutor_added', 'centre_created', 'interview_booked', 'reading_flagged', 'assessor_pack',
  'volunteer_signed_up', 'volunteer_class_starting',
  'referral'
));
