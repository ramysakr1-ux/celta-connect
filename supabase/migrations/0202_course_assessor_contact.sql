-- for-claude-code-course-admin-refinements.md: "Assessor assignment --
-- optional, deferrable, notifies the MCT." Course Admin can optionally
-- name an assessor at wizard time; once a course has a real MCT, they get
-- notified with this contact info. assessor_notified_at is the idempotency
-- guard so that notification only ever fires once per course.
alter table public.courses add column if not exists assessor_name text;
alter table public.courses add column if not exists assessor_email text;
alter table public.courses add column if not exists assessor_notified_at timestamptz;
