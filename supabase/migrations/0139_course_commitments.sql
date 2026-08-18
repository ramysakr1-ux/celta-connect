-- Course Commitments.dc.html: "shown at application, accepted once, before
-- the form can be submitted... recorded on your application file: your
-- name, the date and time you accepted, and the version of this document
-- as it stood that day... your file keeps the text you actually read."
-- Same acknowledged_*_at pattern already used for the other application-
-- time acknowledgements (migration 0081) -- but this one also snapshots
-- the actual assembled text, since the source design is explicit that a
-- later centre revision must never retroactively change what an existing
-- applicant is shown as having accepted.
alter table public.applicants
  add column if not exists commitments_accepted_at timestamptz,
  add column if not exists commitments_snapshot text;

comment on column public.applicants.commitments_snapshot is
  'The exact assembled Course Commitments text shown at the moment this applicant accepted -- not re-derived later, so a subsequent change to the template never rewrites what they actually read.';
