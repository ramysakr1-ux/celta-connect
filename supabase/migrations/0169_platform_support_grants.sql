-- for-claude-code-platform-support-access.md: "nobody at Connect holds a
-- key to any centre's data... platform support only gets in when a centre
-- explicitly invites them, for a stated period, logged." One
-- support@celtaconnect.com account, no standing access -- access exists
-- only as these time-boxed grants.
--
-- Token-based, no real Supabase login for support@ (Ramy did not answer
-- the question asked about this before building; proceeded with the
-- recommended option, same mechanism course_access_tokens already uses for
-- assessors -- reuses proven infrastructure rather than adding a new
-- authenticated role to the whole authorization system. Flagged clearly in
-- the report back).
--
-- Not course_access_tokens itself: that table's course_id is NOT NULL,
-- which billing-scope grants (centre-wide, no course) can't satisfy.
create table public.platform_support_grants (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  -- Null for billing scope; required for course scope.
  course_id uuid references public.courses (id) on delete cascade,
  scope text not null check (scope in ('course', 'billing')),
  -- "Closed to every admin role including the owner, no exception... unless
  -- a request for it is separately and explicitly approved by the main
  -- tutor." Simplified here to a same-form checkbox the MCT (the only
  -- person who can grant course scope at all) ticks themselves when
  -- creating the grant -- their own act of granting IS the approval, since
  -- nobody else could have offered it. A separate support@-initiated
  -- mid-grant request/decline exchange is NOT built -- flagged in the
  -- report, worth a dedicated follow-up if that fuller flow is wanted.
  chat_included boolean not null default false,
  reason text not null,
  duration_hours integer not null check (duration_hours in (6, 24, 72)),
  granted_by uuid not null references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  constraint platform_support_grants_scope_shape check (
    (scope = 'course' and course_id is not null)
    or (scope = 'billing' and course_id is null and chat_included = false)
  )
);

create index platform_support_grants_center_id_idx on public.platform_support_grants (center_id);
create index platform_support_grants_token_idx on public.platform_support_grants (token);

alter table public.platform_support_grants enable row level security;

-- Grant reasons can carry sensitive detail ("investigating a payment
-- dispute for candidate X"), so this is narrower than the usual "any centre
-- member" pattern: a centre_roles holder (oversight over the whole centre)
-- sees every grant; an MCT sees only the course-scope grants on their own
-- course, not billing grants or other courses'.
create policy "platform_support_grants: centre-roles holders read their centre's log"
  on public.platform_support_grants for select
  using (
    exists (
      select 1 from public.centre_roles r
      where r.profile_id = auth.uid() and r.center_id = platform_support_grants.center_id and r.revoked_at is null
    )
  );

create policy "platform_support_grants: an MCT reads their own course's grants"
  on public.platform_support_grants for select
  using (
    scope = 'course'
    and exists (
      select 1 from public.course_tutors t
      where t.course_id = platform_support_grants.course_id
        and t.profile_id = auth.uid()
        and t.tutor_role = 'main_course_tutor'
        and t.left_at is null
    )
  );

-- Every page support@ opens during an active grant window, logged per the
-- spec ("appended to the centre's access log once the grant ends").
create table public.platform_support_grant_activity (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.platform_support_grants (id) on delete cascade,
  page text not null,
  opened_at timestamptz not null default now()
);

create index platform_support_grant_activity_grant_id_idx on public.platform_support_grant_activity (grant_id);

alter table public.platform_support_grant_activity enable row level security;
-- Same shape as the grants table's own two policies -- whoever can see a
-- grant can see that grant's activity log.
create policy "platform_support_grant_activity: centre-roles holders read their centre's activity"
  on public.platform_support_grant_activity for select
  using (
    exists (
      select 1 from public.platform_support_grants g
      join public.centre_roles r on r.center_id = g.center_id and r.revoked_at is null
      where g.id = platform_support_grant_activity.grant_id and r.profile_id = auth.uid()
    )
  );

create policy "platform_support_grant_activity: an MCT reads their own course's activity"
  on public.platform_support_grant_activity for select
  using (
    exists (
      select 1 from public.platform_support_grants g
      join public.course_tutors t on t.course_id = g.course_id and t.tutor_role = 'main_course_tutor' and t.left_at is null
      where g.id = platform_support_grant_activity.grant_id and g.scope = 'course' and t.profile_id = auth.uid()
    )
  );
