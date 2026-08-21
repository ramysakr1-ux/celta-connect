-- connect-platform-owner-role-spec-2026-08-22.md. Split into its own
-- migration deliberately, same reasoning as 0080_admissions_role.sql's own
-- comment when 'admissions' was added: Postgres will not let a new enum
-- value be USED (in a query, a function body, a policy check, a
-- constraint) in the same transaction that ADDs it via ALTER TYPE. 0193
-- (which redefines is_admin() and other admin-only checks to recognise
-- 'platform_owner') must run as a separate statement batch after this one
-- commits.
alter type public.user_role add value if not exists 'platform_owner';
