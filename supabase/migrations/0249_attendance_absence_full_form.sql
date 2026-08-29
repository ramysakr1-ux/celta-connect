-- Attendance record: the columns the Cambridge form actually prints.
--
-- CELTA 5 (July 2023, p.9) has two absence tables and attendance_absences
-- could only fill part of either:
--
--   Unavoidable absences: Date/Times | Session missed | Reason |
--     How work made up | Tutor signature
--   Other absences/late arrivals: Date/Times | Session missed | Reason |
--     Work made up | Candidate comment | Tutor comment/signature
--
-- "Session missed" appears in both and had nowhere to live; "Candidate
-- comment" appears in the second and had nowhere to live; and the tutor's
-- SIGNATURE was being carried by tutor_comment, which is a different thing
-- -- the first table asks for a signature only, the second asks for a
-- comment AND a signature, so one text column cannot honestly serve both.
--
-- Ramy, 29 Aug 2026: "let's have the migration then because we need them."
-- Without these the booklet renders empty cells on a record an assessor
-- reads during the visit.
alter table public.attendance_absences
  add column if not exists session_missed text,
  add column if not exists candidate_comment text,
  add column if not exists tutor_signature_name text,
  add column if not exists tutor_signed_at timestamptz;

comment on column public.attendance_absences.session_missed is
  'CELTA 5 p.9, both tables: which session was missed (e.g. "Input: teaching receptive skills").';
comment on column public.attendance_absences.candidate_comment is
  'CELTA 5 p.9, other absences/late arrivals table only: the candidate''s own comment.';
comment on column public.attendance_absences.tutor_signature_name is
  'CELTA 5 p.9: the tutor signature both tables ask for. Distinct from tutor_comment, which is the comment the second table asks for alongside it.';
comment on column public.attendance_absences.tutor_signed_at is
  'When the tutor signed the row. The date is the evidence, so it is stored rather than derived from updated_at.';
