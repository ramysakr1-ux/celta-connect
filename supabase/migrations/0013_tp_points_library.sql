-- TP Points Library: admins/trainers upload coursebook PDFs per level, and
-- the system generates a reusable bank of TP points (tiered by density band
-- per TP number), reused across cohorts/courses. Generated content starts
-- as pending_review and must be explicitly published by a trainer/admin
-- before it's eligible for rotation-aware assignment (see migration 0014).
--
-- Trainees have no SELECT policy on either table below, on purpose: they
-- never browse the raw library or raw coursebook PDFs, only ever see
-- content via the plan_assignments snapshot (migration 0014).

create table public.tp_coursebooks (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  title text not null,
  level text not null,
  storage_path text not null,
  original_filename text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  generation_status text not null default 'pending'
    check (generation_status in ('pending', 'processing', 'completed', 'failed')),
  generation_error text,
  created_at timestamptz not null default now()
);

create index tp_coursebooks_center_id_idx on public.tp_coursebooks (center_id);

create table public.tp_points (
  id uuid primary key default gen_random_uuid(),
  tp_coursebook_id uuid not null references public.tp_coursebooks (id) on delete cascade,
  center_id uuid not null references public.centers (id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 6),
  sequence_index smallint not null,
  density_tier text not null check (density_tier in ('scripted', 'framework', 'coaching_prose', 'minimal')),
  main_lesson_aim text not null,
  sub_aim text,
  materials_description text,
  procedure jsonb,
  page_references text,
  generation_source text not null default 'ai_generated' check (generation_source in ('ai_generated', 'manual')),
  status text not null default 'pending_review' check (status in ('pending_review', 'published', 'archived')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tp_coursebook_id, tp_number, sequence_index)
);

create index tp_points_coursebook_tp_idx on public.tp_points (tp_coursebook_id, tp_number);
create index tp_points_center_id_idx on public.tp_points (center_id);

create trigger set_updated_at before update on public.tp_points
for each row execute function public.set_updated_at();

alter table public.tp_coursebooks enable row level security;
alter table public.tp_points enable row level security;

create policy "tp_coursebooks: trainer/admin manage their center's coursebooks"
on public.tp_coursebooks for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
);

create policy "tp_points: trainer/admin manage their center's tp points"
on public.tp_points for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
);

-- ============================================================
-- Storage: private bucket for uploaded coursebook PDFs.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('coursebook-pdfs', 'coursebook-pdfs', false);

create policy "coursebook-pdfs: trainer/admin manage their center's PDFs"
on storage.objects for all
to authenticated
using (
  bucket_id = 'coursebook-pdfs'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
)
with check (
  bucket_id = 'coursebook-pdfs'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
);
