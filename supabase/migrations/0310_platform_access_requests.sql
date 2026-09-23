-- Asking to be let in -- the other direction of 0208's invite.
--
-- 0208 gave a centre the power to invite Connect's platform owner in, and a
-- permanent log of every visit made under that grant: "no silent/backdoor
-- viewing". What it never gave was a way to START that conversation. The
-- command centre's Centres table simply said "No access" beside a centre and
-- stopped, so the only way to arrange maintenance access was to leave Connect
-- and email somebody.
--
-- Ramy, 23 Sep 2026, on the mock-up: "ask to be let in is good, build it."
--
-- A request is a question, never a grant. Answering it yes is still the
-- centre's own act, and still writes platform_owner_invites -- nothing here
-- widens what the platform owner can read.
create table public.platform_access_requests (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  note text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  outcome text check (outcome in ('granted', 'declined')),
  -- Resolved means answered: both halves move together or neither does.
  constraint platform_access_requests_resolved_together check (
    (resolved_at is null and outcome is null) or (resolved_at is not null and outcome is not null)
  )
);

create index if not exists platform_access_requests_center_id_idx
  on public.platform_access_requests (center_id);

-- One open question per centre at a time. Asking twice is not more asking, and
-- a centre should never open Settings to a queue of identical requests.
create unique index if not exists platform_access_requests_one_open_per_centre
  on public.platform_access_requests (center_id)
  where resolved_at is null;

alter table public.platform_access_requests enable row level security;

-- The same reader as 0208's invite: this centre's own centre_roles holders,
-- because the request is addressed to them and answering it is their decision.
-- The platform owner reads and writes these through the admin client in its
-- own server-only pages, exactly as it does for the invites themselves.
create policy "platform_access_requests: centre-roles holders answer their own centre's requests"
on public.platform_access_requests for all
to authenticated
using (
  exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.center_id = platform_access_requests.center_id and r.revoked_at is null)
)
with check (
  exists (select 1 from public.centre_roles r where r.profile_id = auth.uid() and r.center_id = platform_access_requests.center_id and r.revoked_at is null)
);
