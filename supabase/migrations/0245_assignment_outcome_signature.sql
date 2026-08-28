-- Ramy, 29 Aug 2026: "the assignments will be generated automatically, but
-- the trainees must sign for the assignments -- if it's pass, for
-- resubmission, second submission, or fail."
--
-- The only candidate signature on an assignment today is
-- first_own_work_confirmed / resubmission_own_work_confirmed, and that is a
-- different thing entirely: a declaration made BEFORE submitting that the
-- work is their own. Nothing records the candidate having seen and accepted
-- the RESULT, which is what the CELTA 5 asks them to sign.
--
-- That matters beyond tidiness. "Pass", "resubmit" and "fail" each carry a
-- consequence -- a resubmission window opening, a resubmission being spent,
-- a criterion left unmet -- and a candidate who later appeals is arguing
-- about a decision there is currently no record of them being shown.
--
-- Separate columns per attempt rather than one, because the first mark and
-- the resubmission mark are two decisions a candidate acknowledges at
-- different times, and a resubmission does not retrospectively re-sign the
-- first.
alter table public.assignments
  add column if not exists first_outcome_signed_at timestamptz,
  add column if not exists first_outcome_signature_name text,
  add column if not exists resubmission_outcome_signed_at timestamptz,
  add column if not exists resubmission_outcome_signature_name text;

comment on column public.assignments.first_outcome_signed_at is
  'When the candidate acknowledged the first-submission result. Not a mark of agreement -- a record that they were shown it.';
comment on column public.assignments.resubmission_outcome_signed_at is
  'As above, for the resubmission result. Separate because it is a second decision, acknowledged separately.';
