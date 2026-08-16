-- The acknowledgement email "says nothing about the outcome and gives a date by
-- which they will hear" (All Emails.dc.html). That date has to come from
-- somewhere, and the centre is the only thing that knows it -- a centre reading
-- applications weekly and one reading them twice a term cannot share a number.
--
-- Not hardcoded in the email template, because an unmet promise made by the
-- software is worse than no promise: the whole point of the line is that the
-- applicant can chase if the date passes.
alter table public.centers
  add column if not exists application_response_days integer not null default 10;

comment on column public.centers.application_response_days is
  'Working days after an application arrives by which the centre promises to respond. Used to compute the date in the acknowledgement email.';
