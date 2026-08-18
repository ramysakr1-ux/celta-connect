-- for-claude-code-centre-settings.md, "1. Profile & Drive": centre profile
-- fields the new Centre Settings screen needs that didn't exist yet --
-- address, primary contact email (distinct from admissions_email, which is
-- specifically the applicant-facing reply-to address), time zone, and
-- currency ("applies to every course unless a course overrides it" --
-- courses.fee_currency already exists per-course and stays the override).

alter table public.centers
  add column address text,
  add column primary_contact_email text,
  add column time_zone text,
  add column currency text;
