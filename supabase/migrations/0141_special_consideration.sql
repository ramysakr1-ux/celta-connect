-- Enrolment Forms.dc.html 1b, "Special consideration -- declared at
-- enrolment": richer than the single free-text field profiles.special_
-- consideration already had -- arrangement chips (what would help) and
-- optional supporting evidence, alongside the existing "tell us in your
-- own words" text. "It does not appear on your certificate and it does
-- not change the standard you are assessed against. It changes what we
-- arrange" -- and "it is the root of an extension... declared here, it is
-- on record before it is needed."
alter table public.profiles
  add column if not exists special_consideration_arrangements text[] not null default '{}',
  add column if not exists special_consideration_evidence_url text;

comment on column public.profiles.special_consideration_arrangements is
  'Multi-select from a fixed list ("What would help") -- extended time, materials in advance, etc. Empty array = none picked.';
comment on column public.profiles.special_consideration_evidence_url is
  'Storage path in the special-consideration-evidence bucket, if the trainee attached a report or letter. Optional.';

-- Same reasoning as volunteer-signup-audio (0089) / applicant-speaking-task-
-- audio (0132): the join/offer-accept flows create the account itself, so
-- there is no session yet to sign a direct browser->Storage write -- the
-- upload happens server-side via the admin client. "Only the course tutors
-- and the centre see this" -- same staff-only read policy as those.
insert into storage.buckets (id, name, public)
values ('special-consideration-evidence', 'special-consideration-evidence', false)
on conflict (id) do nothing;

create policy "special-consideration-evidence: staff read their centre's"
on storage.objects for select
to authenticated
using (
  bucket_id = 'special-consideration-evidence'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
);
