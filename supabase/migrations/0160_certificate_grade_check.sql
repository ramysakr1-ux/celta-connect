-- specs/build-spec.md "Compliance audit -- nineteen open gaps", item 10
-- (Handbook 10.5): "Certificates checked against the recommended grades on
-- arrival; Cambridge contacted immediately on an error." The physical
-- certificate is a separate, later event from final_recommended_grade
-- (the tutor's own recommendation) -- Cambridge can and does occasionally
-- print the wrong one, and the only way to catch it is to compare what
-- arrives against what was recommended.
--
-- Only Pass/Pass B/Pass A/Fail are real certificate outcomes -- a
-- Withdrawn/Extension/Deferred candidate (celta5_records.final_recommended_grade's
-- wider FinalGrade type) never receives one, so this is deliberately its
-- own narrower check rather than reusing that column's constraint.
alter table public.celta5_records add column certificate_grade text check (
  certificate_grade in ('Pass', 'Pass B', 'Pass A', 'Fail')
);
alter table public.celta5_records add column certificate_recorded_at timestamptz;
alter table public.celta5_records add column certificate_recorded_by uuid references public.profiles (id) on delete set null;
