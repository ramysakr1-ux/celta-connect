-- Rotation-aware assignment: trainees are split into fixed subgroups per
-- course at setup (membership doesn't change across the course); within a
-- subgroup, only the teaching order rotates each TP. Rotation order is
-- stored as a trainer-editable base_slot per member, and each TP's actual
-- teaching position is computed via a cyclic shift rather than stored as an
-- explicit per-TP array -- see rotationPosition() in src/lib/rotation.ts,
-- mirrored here in assign_tp_round().
--
-- plan_assignments is a distinct table from tp_lessons, not an extension of
-- it: tp_number was deliberately removed from tp_lessons in migration 0006
-- to make it an open, unnumbered retrospective log. Re-adding numbering
-- there for forward-looking assignment would undo that decision. This new
-- table snapshots assigned content at population time -- once a row
-- exists for a (trainee, tp_number), it is never overwritten by
-- assign_tp_round again, which is what makes "editing rotation order only
-- affects TPs not yet populated" hold by construction.

create table public.course_subgroups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index course_subgroups_course_id_idx on public.course_subgroups (course_id);

create table public.course_subgroup_members (
  id uuid primary key default gen_random_uuid(),
  subgroup_id uuid not null references public.course_subgroups (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  base_slot smallint not null check (base_slot >= 0),
  created_at timestamptz not null default now(),
  unique (trainee_id),
  unique (subgroup_id, base_slot)
);

create table public.course_tp_schedule (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 6),
  tp_coursebook_id uuid not null references public.tp_coursebooks (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, tp_number)
);

create trigger set_updated_at before update on public.course_tp_schedule
for each row execute function public.set_updated_at();

create table public.plan_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 6),
  tp_point_id uuid references public.tp_points (id) on delete set null,
  rotation_position_used smallint not null,
  main_lesson_aim text not null,
  sub_aim text,
  materials_description text,
  procedure jsonb,
  page_references text,
  density_tier text not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (trainee_id, tp_number)
);

create index plan_assignments_course_id_idx on public.plan_assignments (course_id);

create trigger set_updated_at before update on public.plan_assignments
for each row execute function public.set_updated_at();

alter table public.course_subgroups enable row level security;
alter table public.course_subgroup_members enable row level security;
alter table public.course_tp_schedule enable row level security;
alter table public.plan_assignments enable row level security;

-- ---------- course_subgroups ----------

create policy "course_subgroups: trainer manages subgroups in their course"
on public.course_subgroups for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "course_subgroups: admin manages subgroups in their center"
on public.course_subgroups for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ---------- course_subgroup_members ----------
-- Joins to course_subgroups (a different table), never itself -- avoids the
-- self-recursion bug fixed in migration 0010.

create policy "course_subgroup_members: trainee reads their own membership"
on public.course_subgroup_members for select
to authenticated
using (trainee_id = auth.uid());

create policy "course_subgroup_members: trainer manages members in their course"
on public.course_subgroup_members for all
to authenticated
using (
  public.is_trainer() and exists (
    select 1 from public.course_subgroups g
    where g.id = course_subgroup_members.subgroup_id and g.course_id = public.current_course_id()
  )
)
with check (
  public.is_trainer() and exists (
    select 1 from public.course_subgroups g
    where g.id = course_subgroup_members.subgroup_id and g.course_id = public.current_course_id()
  )
);

create policy "course_subgroup_members: admin manages members in their center"
on public.course_subgroup_members for all
to authenticated
using (
  public.is_admin() and exists (
    select 1 from public.course_subgroups g
    join public.courses c on c.id = g.course_id
    where g.id = course_subgroup_members.subgroup_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin() and exists (
    select 1 from public.course_subgroups g
    join public.courses c on c.id = g.course_id
    where g.id = course_subgroup_members.subgroup_id and c.center_id = public.current_center_id()
  )
);

-- ---------- course_tp_schedule ----------

create policy "course_tp_schedule: trainer manages schedule in their course"
on public.course_tp_schedule for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "course_tp_schedule: admin manages schedule in their center"
on public.course_tp_schedule for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ---------- plan_assignments ----------
-- No trainee insert/update/delete policy at all -- population is
-- exclusively via assign_tp_round() below, or trainer/admin edits.

create policy "plan_assignments: trainee reads their own assignments"
on public.plan_assignments for select
to authenticated
using (trainee_id = auth.uid());

create policy "plan_assignments: trainer manages assignments in their course"
on public.plan_assignments for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "plan_assignments: admin manages assignments in their center"
on public.plan_assignments for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ============================================================
-- assign_tp_round: populates plan_assignments for every member of a
-- subgroup for one TP round. Idempotent per member (already-populated
-- rows are skipped, never overwritten) and atomic across the whole
-- subgroup. security invoker (not definer) -- no masking/recursion problem
-- to solve here, so the caller's own RLS grants apply directly.
-- ============================================================

create function public.assign_tp_round(p_subgroup_id uuid, p_tp_number smallint)
returns void
language plpgsql
as $$
declare
  v_course_id uuid;
  v_tp_coursebook_id uuid;
  v_subgroup_size int;
  v_published_count int;
  v_position int;
  v_member record;
  v_tp_point record;
begin
  select course_id into v_course_id from public.course_subgroups where id = p_subgroup_id;
  if v_course_id is null then
    raise exception 'Subgroup not found';
  end if;

  select tp_coursebook_id into v_tp_coursebook_id
  from public.course_tp_schedule
  where course_id = v_course_id and tp_number = p_tp_number;

  if v_tp_coursebook_id is null then
    raise exception 'No coursebook scheduled for TP%', p_tp_number;
  end if;

  select count(*) into v_subgroup_size
  from public.course_subgroup_members where subgroup_id = p_subgroup_id;

  select count(*) into v_published_count
  from public.tp_points
  where tp_coursebook_id = v_tp_coursebook_id and tp_number = p_tp_number and status = 'published';

  if v_published_count < v_subgroup_size then
    raise exception 'Only % of % needed TP points are published for TP%',
      v_published_count, v_subgroup_size, p_tp_number;
  end if;

  for v_member in
    select * from public.course_subgroup_members where subgroup_id = p_subgroup_id
  loop
    continue when exists (
      select 1 from public.plan_assignments
      where trainee_id = v_member.trainee_id and tp_number = p_tp_number
    );

    v_position := ((v_member.base_slot + (p_tp_number - 1)) % v_subgroup_size) + 1;

    select * into v_tp_point
    from public.tp_points
    where tp_coursebook_id = v_tp_coursebook_id
      and tp_number = p_tp_number and status = 'published'
    order by sequence_index
    offset (v_position - 1) limit 1;

    insert into public.plan_assignments (
      course_id, trainee_id, tp_number, tp_point_id, rotation_position_used,
      main_lesson_aim, sub_aim, materials_description,
      procedure, page_references, density_tier, assigned_by
    ) values (
      v_course_id, v_member.trainee_id, p_tp_number, v_tp_point.id, v_position,
      v_tp_point.main_lesson_aim, v_tp_point.sub_aim, v_tp_point.materials_description,
      v_tp_point.procedure, v_tp_point.page_references,
      v_tp_point.density_tier, auth.uid()
    );
  end loop;
end;
$$;
