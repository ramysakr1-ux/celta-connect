-- Who may see a trainer-in-training's record, beyond the training pair.
--
-- Ramy, 4 Sep 2026, settling the Trainer-in-Training tab: it appears only
-- to "the trainee, their supervisor, anyone the MCT grants, and the
-- assessor (view-only)" -- "the MCT should grant access to the ACT" -- and
-- the trainer-in-training sees who has been granted: "Connect is about
-- transparency."
--
-- Until now access was fixed in tit_can_access_course_tutor() (0148, then
-- 0193): the TinT, their supervisor, and admin at the centre. Nothing for
-- the MCT who runs the course, and no way to bring in the ACT the TinT
-- actually shadows. This adds a grant table the MCT controls, and folds
-- the MCT and active grantees into that same function so RLS on every
-- tit_* table follows automatically.
--
-- Shared access leaves a footprint (Ramy, 31 Aug 2026): a grant names who
-- gave it, to whom, when and why; revoking names who and when. Rows are
-- never deleted or edited after revocation -- the table is its own log.

create table if not exists public.tit_access_grants (
  id uuid primary key default gen_random_uuid(),
  -- The trainer-in-training's own course_tutors row, same key tit_records uses.
  course_tutors_id uuid not null references public.course_tutors(id) on delete cascade,
  grantee_profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_by_profile_id uuid not null references public.profiles(id),
  reason text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_profile_id uuid references public.profiles(id),
  constraint tit_access_grants_reason_given check (length(btrim(reason)) > 0),
  constraint tit_access_grants_revocation_attributed check ((revoked_at is null) = (revoked_by_profile_id is null)),
  constraint tit_access_grants_not_self check (grantee_profile_id <> granted_by_profile_id)
);

comment on table public.tit_access_grants is
  'Extra people the MCT has let in to a trainer-in-training record (typically the ACT). Append-only: a grant is revoked by stamping revoked_at/revoked_by, never deleted, so the table doubles as the access log the TinT can read.';

-- One live grant per person per record; re-granting after a revocation
-- makes a new row, keeping the history.
create unique index if not exists tit_access_grants_one_active
  on public.tit_access_grants (course_tutors_id, grantee_profile_id)
  where revoked_at is null;

create index if not exists tit_access_grants_grantee_idx
  on public.tit_access_grants (grantee_profile_id)
  where revoked_at is null;

alter table public.tit_access_grants enable row level security;

-- Is the caller the main course tutor of the course this TinT row is on?
create or replace function public.tit_is_mct_for_course_tutor(target_course_tutors_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_tutors tint
    join public.course_tutors me on me.course_id = tint.course_id
    where tint.id = target_course_tutors_id
      and me.profile_id = auth.uid()
      and me.tutor_role = 'main_course_tutor'
      and me.left_at is null
  );
$$;

-- 0148/0193's function, now also true for the MCT of the course and for
-- anyone holding a live grant. Every tit_* policy calls this, so widening
-- it here widens all of them together.
create or replace function public.tit_can_access_course_tutor(target_course_tutors_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_tutors ct
    join public.courses c on c.id = ct.course_id
    where ct.id = target_course_tutors_id
      and (
        ct.profile_id = auth.uid()
        or ct.supervisor_profile_id = auth.uid()
        or public.tit_is_mct_for_course_tutor(target_course_tutors_id)
        or exists (
          select 1 from public.tit_access_grants g
          where g.course_tutors_id = target_course_tutors_id
            and g.grantee_profile_id = auth.uid()
            and g.revoked_at is null
        )
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'platform_owner') and p.center_id = c.center_id
        )
      )
  );
$$;

-- Read: everyone with access to the record sees its grant list (that is the
-- transparency), plus a grantee always sees their own row.
drop policy if exists "tit_access_grants: readable by everyone on the record" on public.tit_access_grants;
create policy "tit_access_grants: readable by everyone on the record"
on public.tit_access_grants for select
to authenticated
using (
  public.tit_can_access_course_tutor(course_tutors_id)
  or grantee_profile_id = auth.uid()
);

-- Write: the MCT of the course, or admin at the centre. A grant is always
-- attributed to the caller; a revocation likewise, and only while live.
drop policy if exists "tit_access_grants: MCT grants" on public.tit_access_grants;
create policy "tit_access_grants: MCT grants"
on public.tit_access_grants for insert
to authenticated
with check (
  granted_by_profile_id = auth.uid()
  and revoked_at is null
  and (
    public.tit_is_mct_for_course_tutor(course_tutors_id)
    or exists (
      select 1 from public.course_tutors ct
      join public.courses c on c.id = ct.course_id
      join public.profiles p on p.id = auth.uid()
      where ct.id = course_tutors_id and p.role in ('admin', 'platform_owner') and p.center_id = c.center_id
    )
  )
);

drop policy if exists "tit_access_grants: MCT revokes" on public.tit_access_grants;
create policy "tit_access_grants: MCT revokes"
on public.tit_access_grants for update
to authenticated
using (
  revoked_at is null
  and (
    public.tit_is_mct_for_course_tutor(course_tutors_id)
    or exists (
      select 1 from public.course_tutors ct
      join public.courses c on c.id = ct.course_id
      join public.profiles p on p.id = auth.uid()
      where ct.id = course_tutors_id and p.role in ('admin', 'platform_owner') and p.center_id = c.center_id
    )
  )
)
with check (revoked_by_profile_id = auth.uid());

-- No delete policy on purpose: the row is the log.
