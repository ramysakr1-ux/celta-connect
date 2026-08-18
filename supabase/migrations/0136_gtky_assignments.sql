-- design_handoff_open_items_batch, GTKY Activity Bank.dc.html +
-- for-claude-code-gtky-assignment-logic.md. The bank itself is fixed
-- code content (src/lib/gtky-activities.ts), not a table -- this table is
-- only the per-trainee assignment record: which 3 were offered, which one
-- they chose. Activities are referenced by their stable slug (a string,
-- not a DB id), matching how assignment_type/other fixed-content
-- references work elsewhere in this schema.
create table public.gtky_assignments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  level_band text not null check (level_band in ('a1', 'elem', 'pre', 'inter', 'upper')),
  offered_slugs text[] not null,
  chosen_slug text,
  assigned_at timestamptz not null default now(),
  chosen_at timestamptz,
  unique (trainee_id)
);
create index gtky_assignments_course_id_idx on public.gtky_assignments (course_id);

alter table public.gtky_assignments enable row level security;

create policy "gtky_assignments: trainer/admin manage their course"
on public.gtky_assignments for all
to authenticated
using ((public.is_admin() or public.is_trainer()) and course_id = public.current_course_id())
with check ((public.is_admin() or public.is_trainer()) and course_id = public.current_course_id());

-- A trainee reads and updates (picks) only their own row.
create policy "gtky_assignments: trainee reads their own"
on public.gtky_assignments for select
to authenticated
using (trainee_id = auth.uid());

create policy "gtky_assignments: trainee picks their own"
on public.gtky_assignments for update
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());
