-- Enrolment Forms.dc.html 1a, "Disclaimer for AI use" -- Cambridge's own
-- three-section disclaimer (May 2024), verbatim, signed once at enrolment
-- (same "day one" account-creation moment as special consideration, 0141)
-- and referenced for the rest of the course. "It connects to the cover
-- sheets" -- the per-assignment AI declarations (first_ai_declared etc.,
-- migration 0049) already ask a candidate to declare AI use per
-- submission; this is the course-level agreement those refer back to.
alter table public.profiles
  add column if not exists ai_disclaimer_signed_at timestamptz,
  add column if not exists ai_disclaimer_signed_name text;

comment on column public.profiles.ai_disclaimer_signed_name is
  'Typed full name at the moment of signing -- kept as its own field (distinct from full_name, which can change later) so the filed record shows exactly what was signed.';
