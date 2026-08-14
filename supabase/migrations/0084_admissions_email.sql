-- "Every email is from the centre... sender is the centre's name, reply-to
-- is a centre address. Connect never appears in anyone's inbox." Needs a
-- real reply-to address per centre -- nothing on `centers` covers this yet.
alter table public.centers add column admissions_email text;
