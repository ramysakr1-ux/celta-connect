-- Per the CELTA Administration Handbook: if no portfolio is submitted for
-- Grade Review, the outcome is "Withdrawn", not "Fail" -- a distinct third
-- outcome the original check constraint didn't allow for.

alter table public.celta5_records
  drop constraint if exists celta5_records_final_recommended_grade_check;

alter table public.celta5_records
  add constraint celta5_records_final_recommended_grade_check
  check (final_recommended_grade in ('Pass', 'Pass B', 'Pass A', 'Fail', 'Withdrawn'));
