-- All Emails.dc.html specifies two emails to volunteers -- "Thank you for
-- volunteering" on sign-up, and "Your free English classes start Monday" when a
-- class needs learners. Neither could be sent: the volunteer model carries a
-- name and a level and no address anywhere.
--
-- Nullable on purpose. The inventory's own note against the sign-up email is
-- "No account", and that stays true: a volunteer still never gets a login. A
-- volunteer added at the door by a member of staff may have no email at all,
-- and must remain a perfectly valid volunteer -- so the two emails are sent
-- when an address exists and skipped when it doesn't, rather than the address
-- becoming a condition of taking part.
alter table public.volunteer_students add column if not exists email text;

comment on column public.volunteer_students.email is
  'Optional. Used only for the two volunteer emails. A volunteer never has an account, and a volunteer without an email is valid.';
