-- build-spec.md §18 "Contacting a candidate outside Connect": phone matters
-- more than email for the real cases -- "you are not here and your TP
-- starts in twenty minutes" -- but profiles never had anywhere to hold one.
-- Nullable: historical rows collected nothing here, and a candidate who
-- joined by direct course link (no applicant record to carry a number
-- across) may simply not have supplied one.
alter table public.profiles add column phone text;
