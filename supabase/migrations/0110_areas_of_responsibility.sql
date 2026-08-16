-- build-spec.md §11. Separate from the four admin roles: "A **role** says what
-- someone is capable of; an **area** says what is actually their job."
--
-- The design principle that makes this different from a permission is how a
-- non-owner sees an action: "Where the owner sees 'Send offer', a colleague
-- sees 'Selin handles offers', her name linking to a message. **Hiding a
-- button tells you nothing; naming the person answers the question you
-- actually have.**"
--
-- So this is the opposite treatment to the Centre manager's read-only role,
-- where buttons are absent. Both are right in their own place, and the
-- difference is the point: a manager cannot act at all, whereas a colleague
-- outside an area is asking "who does this?" and deserves an answer.

create table public.centre_areas (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,

  -- The six the spec names. Not open-ended: an area nobody recognises is worse
  -- than no area, because the attribution would name a job title no one holds.
  area text not null check (area in (
    'admissions',
    'payments',
    'volunteers',
    'timetabling',
    'assessor_liaison',
    'close_out'
  )),

  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- "Nobody edits their own role or their own areas. The centre owner assigns
  -- both. Self-promotion must be impossible, or the ceiling on any admin's
  -- powers is whatever they feel like today."
  assigned_by uuid not null references public.profiles (id),
  assigned_at timestamptz not null default now(),

  -- "Areas can be handed over temporarily, with an end date, so holiday cover
  -- does not become a permanent reassignment nobody remembers to undo."
  -- Null means indefinite; a date means it lapses on its own.
  ends_at date,

  revoked_at timestamptz,

  -- One holder per area per centre at a time. A handover revokes the previous
  -- row rather than adding a second, so "who handles offers" always has one
  -- answer.
  unique (center_id, area, profile_id)
);
create index centre_areas_center_id_idx on public.centre_areas (center_id);
create index centre_areas_profile_id_idx on public.centre_areas (profile_id);

alter table public.centre_areas enable row level security;

-- "**Everyone sees everything.** Areas never hide information." So every admin
-- in the centre can read who holds what -- that is the whole point of naming
-- the person rather than hiding the button.
--
-- Written without current_center_id()/has_centre_role() to avoid the recursion
-- trap migration 0010 hit: those read centre_roles, and a policy here that
-- called them would recurse through the same permission machinery.
create policy "centre_areas: the centre's admins can see who holds what"
on public.centre_areas for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.center_id = centre_areas.center_id
  )
);

-- No insert/update/delete policy on purpose: assigning an area is a Centre
-- owner action and runs server-side after that check, the same pattern
-- centre_roles uses. A session cannot write this table, so nobody can hand
-- themselves an area.
