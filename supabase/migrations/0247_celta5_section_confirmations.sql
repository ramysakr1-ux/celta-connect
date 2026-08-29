-- Ramy, 30 Aug 2026: "the one I gave you is the entire CELTA 5 in there so
-- they can read it -- I wanted them to read everything in there."
--
-- Reading the real booklet text made the reason plain, and it is not just
-- completeness. Two of the static sections END IN A CANDIDATE
-- CONFIRMATION, which Connect has nowhere to record:
--
--   Candidate portfolio -- "I confirm that I have understood and accept the
--   above requirements for the CELTA portfolio and that without meeting
--   these requirements, it will not be [assessed]." Name / Signed.
--
--   Cambridge English appeals procedure -- "I confirm that I have read the
--   Cambridge English Appeals Procedure." Name.
--
-- That is why the whole text has to be in the page rather than behind a
-- link to a PDF: the reading and the signing are the same act, and a
-- confirmation attached to text the candidate never saw is worth nothing.
-- It also answers "where do people sign" -- section by section, as they
-- read, in Cambridge's own order, not gathered into a ledger at the end.
alter table public.celta5_records
  add column if not exists portfolio_terms_confirmed_at timestamptz,
  add column if not exists portfolio_terms_signature_name text,
  add column if not exists appeals_read_confirmed_at timestamptz,
  add column if not exists appeals_read_signature_name text;

comment on column public.celta5_records.portfolio_terms_confirmed_at is
  'Candidate confirmed they understand and accept the CELTA portfolio requirements (CELTA 5, Candidate Portfolio section).';
comment on column public.celta5_records.appeals_read_confirmed_at is
  'Candidate confirmed they have read the Cambridge English Appeals Procedure (CELTA 5, Appeals section).';

-- No backfill. These are declarations a candidate makes about text they
-- have read; there is no honest value to assume for someone who has never
-- been shown the section. Existing records start unconfirmed, which is
-- true.
