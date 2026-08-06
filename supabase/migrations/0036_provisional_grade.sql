-- The real "provisional grade" concept, distinct from final_recommended_grade
-- (which stays hidden from trainees per 0034's correction). Set by the
-- trainer around Stage 2 (~TP6), suggested by computeTrajectory() but always
-- a trainer judgment call, same pattern as every other rating in this app.
-- When the trainer is genuinely unsure between two adjacent grades, both
-- provisional_grade (the lower/primary) and provisional_grade_upper (the
-- higher, only set when uncertain -- a "slashed" candidate, e.g. "Pass /
-- Pass B") are set; otherwise provisional_grade_upper stays null.
alter table public.celta5_records add column provisional_grade text check (
  provisional_grade in ('Pass', 'Pass B', 'Pass A', 'Fail', 'Withdrawn')
);

alter table public.celta5_records add column provisional_grade_upper text check (
  provisional_grade_upper in ('Pass', 'Pass B', 'Pass A', 'Fail', 'Withdrawn')
);

alter table public.celta5_records add column provisional_set_at timestamptz;
