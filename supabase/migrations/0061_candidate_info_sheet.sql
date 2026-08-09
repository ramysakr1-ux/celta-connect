-- remaining-compliance.md item 4: "the electronic candidate information
-- sheet" -- today collected outside the app (data exists twice, CELTA 5
-- header typed by hand). Folds the one field it actually adds (ULN) into
-- enrolment; every other CELTA 5 front-matter field (name, centre, course,
-- tutors) is already real data elsewhere and just needs a header built to
-- read it, not a new column.
--
-- ULN only applies to UK centres (Unique Learner Number, Personal Learning
-- Record). is_uk_centre gates whether the join form even shows the field.

alter table public.centers
  add column is_uk_centre boolean not null default false;

alter table public.profiles
  add column uln text;
