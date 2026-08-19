-- 3c ("helping learners to develop writing skills") was wrongly treated as
-- a non-official session-mapping-only code until 2026-08-19, when it was
-- confirmed as a genuine Cambridge criterion against the official CELTA
-- Syllabus and Assessment Guidelines PDF (cambridgeenglish.org) -- Section 3
-- has three codes (3a/3b/3c), not two, taking the full criteria set from
-- 41 to 42. celta5_matrix.insert already derives its rows from
-- CELTA_CRITERIA_CODES (src/lib/celta-criteria.ts), so every trainee joined
-- from here on gets a 3c row automatically. Trainees already in the table
-- before this fix don't -- backfilled here the same shape the insert code
-- uses, one row per existing trainee that has no 3c row yet.
insert into public.celta5_matrix (course_id, trainee_id, criteria_code)
select m.course_id, m.trainee_id, '3c'
from public.celta5_matrix m
where m.criteria_code = '3a'
  and not exists (
    select 1 from public.celta5_matrix m2
    where m2.trainee_id = m.trainee_id and m2.criteria_code = '3c'
  );
