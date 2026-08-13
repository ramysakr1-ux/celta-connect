-- project_tp_points_library_spec.md, confirmed with Ramy 2026-08-01:
-- "Multi-source generation: let one generation call take multiple PDFs at
-- once (Student's Book + Workbook + Teacher's Book together)... Avoid-
-- repeats across sets: when generating a new set for the same coursebook,
-- tell the model which main aims/units were already used in prior sets so
-- it actively picks different material." A "set" is one tp_coursebooks row
-- (the existing "Speakout B2 (Set 1)" / "(Set 2)" naming) -- avoid-repeat
-- works ACROSS separate coursebook rows, not within one (the existing
-- unique(tp_coursebook_id, tp_number, sequence_index) constraint already
-- prevents a silent double-run on the same row; that was never the gap).

-- Additional PDFs beyond the primary one (tp_coursebooks.storage_path,
-- unchanged, stays the first/required source). One-to-many rather than
-- widening storage_path to an array, so each extra source keeps its own
-- label and original filename.
create table public.tp_coursebook_sources (
  id uuid primary key default gen_random_uuid(),
  tp_coursebook_id uuid not null references public.tp_coursebooks (id) on delete cascade,
  label text,
  storage_path text not null,
  original_filename text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tp_coursebook_sources_coursebook_id_idx on public.tp_coursebook_sources (tp_coursebook_id);

alter table public.tp_coursebook_sources enable row level security;

create policy "tp_coursebook_sources: trainer/admin manage their center's sources"
on public.tp_coursebook_sources for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.tp_coursebooks c
    where c.id = tp_coursebook_sources.tp_coursebook_id and c.center_id = public.current_center_id()
  )
)
with check (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.tp_coursebooks c
    where c.id = tp_coursebook_sources.tp_coursebook_id and c.center_id = public.current_center_id()
  )
);

-- Records which other coursebook rows (sibling sets) generation was told
-- to avoid overlapping with -- shown back on the detail page, and used to
-- default the picker if regenerated later. Purely informational; the
-- actual avoidance is a prompt-time instruction, not enforced by the DB.
alter table public.tp_coursebooks add column avoid_repeat_of uuid[] not null default '{}';
