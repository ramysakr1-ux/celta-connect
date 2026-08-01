-- Cambridge-assigned center number: required and unique per center.
-- Backfill any existing rows with a placeholder first since existing data
-- (created before this constraint existed) has no value yet -- update these
-- through the admin UI once a center-edit screen exists.

update public.centers
set center_number = 'PENDING-' || substr(id::text, 1, 8)
where center_number is null;

alter table public.centers
  alter column center_number set not null;

alter table public.centers
  add constraint centers_center_number_key unique (center_number);
