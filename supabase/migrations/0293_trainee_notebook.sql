-- The trainee's notebook. Ramy, 12 Sep 2026: "like having a notebook with
-- you" -- a small round pen on every trainee page, a panel that opens over
-- the page, plain text, saved as you type, and the paper colour is theirs to
-- choose. Each note remembers the page it was written on (anchor_path,
-- anchor_label) so the notebook reads back as "TP4 feedback · 12 Sept".
--
-- Private to the trainee: the only policies are the trainee's own. No
-- trainer, admin or assessor read. Not covered by the demo write block --
-- a note is the viewer's own scratch, and the demo account's notes go with
-- the course on the next rebuild (profiles cascade).
-- Re-runnable.
create table if not exists public.trainee_notes (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  anchor_path text not null default '',
  anchor_label text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trainee_notes_trainee_idx on public.trainee_notes (trainee_id, created_at desc);

drop trigger if exists set_updated_at on public.trainee_notes;
create trigger set_updated_at before update on public.trainee_notes
for each row execute function public.set_updated_at();

alter table public.trainee_notes enable row level security;
drop policy if exists "trainee_notes: own only" on public.trainee_notes;
create policy "trainee_notes: own only" on public.trainee_notes
  for all to authenticated
  using ((select auth.uid()) = trainee_id)
  with check ((select auth.uid()) = trainee_id);

-- The paper colour, one row per trainee.
create table if not exists public.trainee_notebook_settings (
  trainee_id uuid primary key references public.profiles (id) on delete cascade,
  paper text not null default 'blue' check (paper in ('blue', 'pink', 'cream', 'mint', 'lavender', 'white')),
  updated_at timestamptz not null default now()
);
alter table public.trainee_notebook_settings enable row level security;
drop policy if exists "trainee_notebook_settings: own only" on public.trainee_notebook_settings;
create policy "trainee_notebook_settings: own only" on public.trainee_notebook_settings
  for all to authenticated
  using ((select auth.uid()) = trainee_id)
  with check ((select auth.uid()) = trainee_id);
