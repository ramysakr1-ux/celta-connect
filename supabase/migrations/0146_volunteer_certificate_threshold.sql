-- Connect Build Audit: "160hr threshold as a centre setting -- hardcoded
-- constant, own comment admits there's no setting yet." volunteer-attendance.ts
-- called 160 "the spec's own illustrative figure" -- a real centre may run a
-- different certificate scheme, so this makes it editable rather than fixed.
alter table public.centers add column volunteer_certificate_hours_threshold integer not null default 160
  check (volunteer_certificate_hours_threshold > 0);
