-- Extension and Deferral as grade values, and a live bug closed on the way.
--
-- The live Cambridge Centre Grade Form's provisional dropdown carries ten
-- values (read in Appian against TR073-C17/2026, 25 Sep 2026): seven grades,
-- then Withdrawn, Extension and Deferral. Connect offered only the first
-- eight. Ramy, same day: add the other two.
--
-- THE BUG: celta5_records.final_recommended_grade already had 'Extension' and
-- 'Deferred' as options in the UI (final-report-fields.tsx) while its CHECK
-- constraint allowed neither. Choosing either would have failed at the
-- database. Nothing has hit it because no row carries those values yet --
-- checked before writing this: final_recommended_grade is null on 24 rows,
-- Pass on 1, Pass B on 1.
--
-- Cambridge's word is "Deferral", not "Deferred"; the UI is corrected to
-- match in the same change. No stored value has to move, because none exists.
--
-- provisional_grade_upper is deliberately NOT widened: it holds only the upper
-- half of a slash pair, and an outcome is never one.
--
-- Re-runnable.

alter table public.celta5_records
  drop constraint if exists celta5_records_provisional_grade_check;
alter table public.celta5_records
  add constraint celta5_records_provisional_grade_check
  check (provisional_grade = any (array[
    'Pass'::text, 'Pass B'::text, 'Pass A'::text, 'Fail'::text,
    'Withdrawn'::text, 'Extension'::text, 'Deferral'::text]));

alter table public.celta5_records
  drop constraint if exists celta5_records_final_recommended_grade_check;
alter table public.celta5_records
  add constraint celta5_records_final_recommended_grade_check
  check (final_recommended_grade = any (array[
    'Pass'::text, 'Pass B'::text, 'Pass A'::text, 'Fail'::text,
    'Withdrawn'::text, 'Extension'::text, 'Deferral'::text]));
