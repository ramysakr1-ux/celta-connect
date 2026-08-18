-- Assessor welcome email + consent gate (design_handoff_all_emails,
-- email #18 "Assessor visit pack" + Invitations.dc.html screen 1d).
-- "Acceptance is remembered against the link, so a second visit goes
-- straight in. Re-issuing the link asks again" -- so this lives on the
-- token row itself, not a separate table: the token IS "the link."
alter table public.course_access_tokens
  add column if not exists terms_accepted_at timestamptz;

comment on column public.course_access_tokens.terms_accepted_at is
  'Assessor-only today: set once they accept the "before you open the pack" gate. Null blocks access to everything past the gate. A re-issued token is a new row, so re-sharing a link always asks again.';
