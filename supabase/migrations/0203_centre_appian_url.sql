-- for-claude-code-course-admin-landing-and-admissions.md §3: Cambridge
-- gives every centre the same Appian sign-in URL -- one centre-level
-- setting, not per course. Entry Form's "Open Appian" link reads this.
alter table public.centers add column if not exists appian_url text;
