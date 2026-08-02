-- Phase 2: written assignments. Each centre uploads its own brief per
-- assignment type; Claude parses it into chunked sections (mirrors the
-- coursebook -> TP points pipeline in migration 0013), a trainer/admin
-- edits and publishes it, and trainees then fill in one response box per
-- section. Submission/lock reuses the EXISTING assignments.first_status /
-- resubmission_status enum (already exactly the lock mechanism this needs)
-- rather than adding a new one -- this migration only adds the section
-- content and a validated way for trainees to flip those statuses.
--
-- Note: the original migration 0001 gave trainees a broad, unrestricted
-- UPDATE policy on their own assignments row (a leftover from the old
-- external-URL submission model). That's dropped below -- a trainee could
-- otherwise set their own final_grade directly. submit_assignment_round()
-- is now the only way a trainee can change their assignment's status.

drop policy "assignments: trainee can submit their own work" on public.assignments;

create table public.assignment_templates (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  assignment_type text not null check (
    assignment_type in ('Focus on Learner', 'LRT', 'Skills', 'LfC')
  ),
  storage_path text not null,
  original_filename text,
  sections jsonb not null default '[]'::jsonb,
  generation_status text not null default 'pending'
    check (generation_status in ('pending', 'processing', 'completed', 'failed')),
  generation_error text,
  published_at timestamptz,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, assignment_type)
);

create trigger set_updated_at before update on public.assignment_templates
for each row execute function public.set_updated_at();

create table public.assignment_section_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  section_key text not null,
  section_title text not null,
  first_response text,
  first_comments text,
  resubmission_response text,
  resubmission_comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, section_key)
);

create index assignment_section_responses_assignment_id_idx on public.assignment_section_responses (assignment_id);

create trigger set_updated_at before update on public.assignment_section_responses
for each row execute function public.set_updated_at();

-- A trainee writing their own response row (INSERT or UPDATE) can never set
-- the trainer's comment columns, regardless of what a raw client call sends
-- -- RLS alone can't restrict individual columns, only whole rows.
create function public.guard_assignment_section_response_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trainer() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.first_comments := null;
    new.resubmission_comments := null;
  else
    new.first_comments := old.first_comments;
    new.resubmission_comments := old.resubmission_comments;
  end if;
  return new;
end;
$$;

create trigger guard_trainee_comment_columns
before insert or update on public.assignment_section_responses
for each row execute function public.guard_assignment_section_response_columns();

-- The only way a trainee can move their own assignment through
-- not_submitted -> submitted, or resubmission_required -> submitted.
-- Direct UPDATE access to assignments.first_status/resubmission_status
-- (and everything else on that row) is otherwise trainer/admin only.
create function public.submit_assignment_round(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.assignments;
begin
  select * into v_assignment
  from public.assignments
  where id = p_assignment_id and trainee_id = auth.uid();

  if v_assignment.id is null then
    raise exception 'Assignment not found.';
  end if;

  if v_assignment.first_status = 'not_submitted' then
    if v_assignment.due_date is not null and v_assignment.due_date < current_date then
      raise exception 'The deadline for this assignment has passed.';
    end if;
    update public.assignments
    set first_status = 'submitted', first_submitted_at = now()
    where id = p_assignment_id;
  elsif v_assignment.first_status = 'resubmission_required'
        and v_assignment.resubmission_status = 'not_submitted' then
    update public.assignments
    set resubmission_status = 'submitted', resubmission_submitted_at = now()
    where id = p_assignment_id;
  else
    raise exception 'This assignment is not awaiting submission.';
  end if;
end;
$$;

alter table public.assignment_templates enable row level security;
alter table public.assignment_section_responses enable row level security;

-- ---------- assignment_templates ----------

create policy "assignment_templates: trainee reads published templates in their center"
on public.assignment_templates for select
to authenticated
using (published_at is not null and center_id = public.current_center_id());

create policy "assignment_templates: trainer/admin manage their center's templates"
on public.assignment_templates for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
);

-- ---------- assignment_section_responses ----------

create policy "assignment_section_responses: trainee reads their own"
on public.assignment_section_responses for select
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_section_responses.assignment_id and a.trainee_id = auth.uid()
  )
);

create policy "assignment_section_responses: trainee writes while unlocked"
on public.assignment_section_responses for all
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_section_responses.assignment_id
      and a.trainee_id = auth.uid()
      and (
        a.first_status = 'not_submitted'
        or (a.first_status = 'resubmission_required' and a.resubmission_status = 'not_submitted')
      )
  )
)
with check (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_section_responses.assignment_id
      and a.trainee_id = auth.uid()
      and (
        a.first_status = 'not_submitted'
        or (a.first_status = 'resubmission_required' and a.resubmission_status = 'not_submitted')
      )
  )
);

create policy "assignment_section_responses: trainer manages in their course"
on public.assignment_section_responses for all
to authenticated
using (
  public.is_trainer()
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_section_responses.assignment_id and a.course_id = public.current_course_id()
  )
)
with check (
  public.is_trainer()
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_section_responses.assignment_id and a.course_id = public.current_course_id()
  )
);

create policy "assignment_section_responses: admin manages in their center"
on public.assignment_section_responses for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.assignments a
    join public.courses c on c.id = a.course_id
    where a.id = assignment_section_responses.assignment_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.assignments a
    join public.courses c on c.id = a.course_id
    where a.id = assignment_section_responses.assignment_id and c.center_id = public.current_center_id()
  )
);

-- ============================================================
-- Storage: private bucket for uploaded assignment brief PDFs.
-- Trainer/admin only, same pattern as coursebook-pdfs (migration 0013) --
-- trainees never see the raw brief, only the parsed+published sections.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('assignment-briefs', 'assignment-briefs', false);

create policy "assignment-briefs: trainer/admin manage their center's briefs"
on storage.objects for all
to authenticated
using (
  bucket_id = 'assignment-briefs'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
)
with check (
  bucket_id = 'assignment-briefs'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
);
