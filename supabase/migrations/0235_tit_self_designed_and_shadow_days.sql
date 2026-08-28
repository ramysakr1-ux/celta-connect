-- Ramy, 28 Aug 2026: two more real gaps from
-- specs/for-claude-code-trainer-in-training.md.

-- Task Twelve Stage 2 (line 18): "fully self-designed by the TinT, never
-- reused from the centre's own Resource Hub library" -- nothing attested
-- or checked this at all before. Real content-similarity detection is out
-- of scope; a required, timestamped attestation is the honest minimum.
alter table public.tit_delivered_sessions
  add column self_designed_attested_at timestamptz;

comment on column public.tit_delivered_sessions.self_designed_attested_at is
  'When the TinT confirmed this session was fully self-designed, not adapted from the Resource Hub library.';

-- Mode-shadow restriction (line 26): "Trained online only -> must shadow
-- the equivalent of at least 3 days on a face-to-face course before
-- tutoring face-to-face. Same rule in reverse." No tracking existed for
-- shadow days logged per mode at all.
create table public.tit_shadow_days (
  id uuid primary key default gen_random_uuid(),
  tit_record_id uuid not null references public.tit_records (id) on delete cascade,
  mode text not null check (mode in ('f2f', 'online')),
  shadowed_at date not null,
  note text,
  created_at timestamptz not null default now()
);
create index tit_shadow_days_tit_record_id_idx on public.tit_shadow_days (tit_record_id);

alter table public.tit_shadow_days enable row level security;

create policy "tit_shadow_days: same access as its record"
on public.tit_shadow_days for all
to authenticated
using (public.tit_can_access(tit_record_id))
with check (public.tit_can_access(tit_record_id));
