-- Per-center Google Drive connection, used to sync the CELTA5 record into
-- a copy of the center's own Google Doc template. One connection per
-- center: each center authorizes its own Drive via OAuth (their compliance
-- documents shouldn't live in another center's Drive), done once by an
-- admin when the center sets this up.
--
-- No RLS policies are granted to the authenticated role on purpose --
-- refresh_token is a live credential and must never be readable via the
-- browser client. All access goes through server actions using the
-- service-role client, matching the pattern already used for admin invite
-- operations elsewhere in this app.

create table public.center_google_connections (
  center_id uuid primary key references public.centers (id) on delete cascade,
  connected_by uuid references public.profiles (id) on delete set null,
  refresh_token text not null,
  template_doc_id text,
  output_folder_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.center_google_connections enable row level security;

create trigger set_updated_at before update on public.center_google_connections
for each row execute function public.set_updated_at();
