-- TP Audio Library: a plain, separate library of real coursebook audio
-- tracks (Class Audio / Workbook Audio), browsable by level and
-- coursebook -- same UI pattern as the Resource Hub and TP Points
-- Library (migration 0013), no new architecture.
--
-- Deliberately NOT tagged per TP-point/stage -- retagging ~144 existing
-- tp_points rows by hand was ruled out as too much manual work. Instead,
-- each file is uploaded under a *consistent filename* that mirrors how
-- tp_points.procedure text already refers to recordings (e.g. procedure
-- text says "Recording 4.03" -> file is named Recording_4.03.mp3), so a
-- later pass can pattern-match text mentions to library files and link
-- them automatically without retagging anything by hand. That
-- auto-linking UI does not exist yet -- this migration only adds the
-- library itself.
--
-- Trainee access is intentionally NOT granted here (same posture as
-- tp_coursebooks/tp_points -- trainees don't browse the raw library).
-- Whether trainees should ever browse audio directly, vs. only ever
-- hitting it via a future auto-linked TP-card player, is Ramy's call to
-- make later -- not decided by this migration.

create table public.tp_audio_library (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  level text not null,
  coursebook_title text not null,
  unit_label text,
  file_name text not null,
  storage_path text not null,
  original_filename text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (center_id, storage_path)
);

create index tp_audio_library_center_level_book_idx
  on public.tp_audio_library (center_id, level, coursebook_title);

alter table public.tp_audio_library enable row level security;

create policy "tp_audio_library: trainer/admin manage their center's audio"
on public.tp_audio_library for all
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
-- Storage: private bucket for uploaded audio tracks.
-- ============================================================
-- NOTE: this bucket is created ahead of this migration landing (via the
-- Storage admin API, which doesn't require a DB migration to run) so
-- real files could be uploaded the same night this table was designed.
-- The `on conflict do nothing` makes this statement safe to run even
-- though the bucket row may already exist.

insert into storage.buckets (id, name, public)
values ('tp-audio', 'tp-audio', false)
on conflict (id) do nothing;

create policy "tp-audio: trainer/admin manage their center's audio files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'tp-audio'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
)
with check (
  bucket_id = 'tp-audio'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
);
