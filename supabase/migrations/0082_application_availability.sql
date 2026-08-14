-- Phase B: the public application page needs a course to be explicitly
-- open for applications and a real capacity to compute availability
-- against -- "the intake dropdown shows real availability... never a
-- manufactured figure." Both null/default-off so no existing course is
-- accidentally exposed for applications the moment this migration runs.
alter table public.courses add column application_cap integer;
alter table public.courses add column accepting_applications boolean not null default false;

-- "3 places left" at or below this threshold (default 4).
alter table public.centers add column application_low_availability_threshold integer not null default 4;
