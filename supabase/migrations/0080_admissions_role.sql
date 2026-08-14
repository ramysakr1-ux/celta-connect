-- Split into its own migration deliberately: Postgres will not let a new
-- enum value be USED (in a query, a function body invocation, a policy
-- check) in the same transaction that ADDs it via ALTER TYPE. 0081 (which
-- defines is_admissions_staff() etc. referencing 'admissions') must run
-- as a separate statement batch after this one commits.
alter type public.user_role add value if not exists 'admissions';
