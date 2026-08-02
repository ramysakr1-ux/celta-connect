-- Phase 1 "TP card": the trainee-authored lesson plan + language analysis
-- sheet, materials attachments, self-evaluation, and trainer feedback+grade.
-- Deliberately distinct from plan_assignments (the rotation-assigned BRIEF,
-- migration 0014 -- a push-model, read-only seed) and tp_lessons (the
-- trainer's taught-gate outcome log, migrations 0006/0017/0018) -- neither
-- of those is touched here. See project_content_architecture_spec memory
-- for the full design rationale.
--
-- Lock mechanism: submitted_at is the one new pattern here. NULL = editable
-- draft; non-null = locked/view-only for the trainee. Enforced at the RLS
-- level (trainee UPDATE policies require submitted_at is null on the
-- pre-image row, so a locked row can never be modified by the trainee again)
-- as well as in the UI. Trainer/admin policies have no such restriction, so
-- they can always "reopen" a plan by nulling submitted_at back out.

create table public.tp_plans (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 6),
  plan_assignment_id uuid references public.plan_assignments (id) on delete set null,
  main_aims text,
  subsidiary_aims text,
  personal_aims text,
  class_profile text,
  materials_description text,
  anticipated_problems jsonb not null default '[]'::jsonb,
  framework_used text,
  procedure jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainee_id, tp_number)
);

create index tp_plans_course_id_idx on public.tp_plans (course_id);

create trigger set_updated_at before update on public.tp_plans
for each row execute function public.set_updated_at();

-- Language analysis sheet is optional per lesson (0-or-1 row per plan) --
-- collapsed/unopened by default in the UI, omitted from the assembled PDF
-- entirely if nothing meaningful was filled in.
create table public.tp_language_analyses (
  id uuid primary key default gen_random_uuid(),
  tp_plan_id uuid not null references public.tp_plans (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'grammar' check (type in ('grammar', 'vocab', 'function')),
  is_main_aim boolean not null default false,
  context text,
  blocks jsonb not null default '[]'::jsonb,
  vocab_rows jsonb not null default '[]'::jsonb,
  vocab_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tp_plan_id)
);

create trigger set_updated_at before update on public.tp_language_analyses
for each row execute function public.set_updated_at();

-- Materials are the one part of the TP card that's a real file (or an
-- optional live Slides link) rather than typed content -- multiple rows
-- allowed per plan (a lesson can have several handouts).
create table public.tp_materials (
  id uuid primary key default gen_random_uuid(),
  tp_plan_id uuid not null references public.tp_plans (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text,
  file_name text,
  file_type text check (file_type in ('pdf', 'image')),
  slides_url text,
  created_at timestamptz not null default now(),
  check (storage_path is not null or slides_url is not null)
);

create index tp_materials_tp_plan_id_idx on public.tp_materials (tp_plan_id);

-- Self-evaluation is its own submit-locked document (not gated by tp_plans'
-- lock) -- it only becomes writable once the trainer has logged this TP as
-- taught (plan_assignments.taught_at, migration 0017 -- the existing
-- taught-gate signal, reused rather than reinvented).
create table public.tp_self_evaluations (
  id uuid primary key default gen_random_uuid(),
  tp_plan_id uuid not null references public.tp_plans (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 6),
  what_went_well text,
  what_not_as_planned text,
  evidence_of_learning text,
  what_differently text,
  next_tp_focus text,
  action_points jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tp_plan_id)
);

create trigger set_updated_at before update on public.tp_self_evaluations
for each row execute function public.set_updated_at();

-- Trainer-authored feedback + grade. A starred action point here is what
-- the *next* TP's self-evaluation queries for "action points from last
-- TP" -- a live relational read instead of the hand-passed JSON file the
-- prototype used.
create table public.tp_feedback (
  id uuid primary key default gen_random_uuid(),
  tp_plan_id uuid not null references public.tp_plans (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 6),
  trainer_id uuid references public.profiles (id) on delete set null,
  grade text check (grade in ('above_standard', 'to_standard', 'not_to_standard')),
  strengths_planning jsonb not null default '[]'::jsonb,
  action_points_planning jsonb not null default '[]'::jsonb,
  strengths_teaching jsonb not null default '[]'::jsonb,
  action_points_teaching jsonb not null default '[]'::jsonb,
  overall_comment text,
  self_eval_comment text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tp_plan_id)
);

create trigger set_updated_at before update on public.tp_feedback
for each row execute function public.set_updated_at();

alter table public.tp_plans enable row level security;
alter table public.tp_language_analyses enable row level security;
alter table public.tp_materials enable row level security;
alter table public.tp_self_evaluations enable row level security;
alter table public.tp_feedback enable row level security;

-- ---------- tp_plans ----------

create policy "tp_plans: trainee reads their own plans"
on public.tp_plans for select
to authenticated
using (trainee_id = auth.uid());

create policy "tp_plans: trainee inserts their own draft plans"
on public.tp_plans for insert
to authenticated
with check (trainee_id = auth.uid());

create policy "tp_plans: trainee updates their own plans while unsubmitted"
on public.tp_plans for update
to authenticated
using (trainee_id = auth.uid() and submitted_at is null)
with check (trainee_id = auth.uid());

create policy "tp_plans: trainer manages plans in their course"
on public.tp_plans for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "tp_plans: admin manages plans in their center"
on public.tp_plans for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ---------- tp_language_analyses ----------
-- Two trainee policies: a lock-gated "for all" (insert/update/delete only
-- while the parent plan is unsubmitted) plus an unrestricted select, so
-- reading a locked LA sheet still works.

create policy "tp_language_analyses: trainee reads their own"
on public.tp_language_analyses for select
to authenticated
using (trainee_id = auth.uid());

create policy "tp_language_analyses: trainee writes their own while plan unsubmitted"
on public.tp_language_analyses for all
to authenticated
using (
  trainee_id = auth.uid()
  and exists (select 1 from public.tp_plans p where p.id = tp_language_analyses.tp_plan_id and p.submitted_at is null)
)
with check (
  trainee_id = auth.uid()
  and exists (select 1 from public.tp_plans p where p.id = tp_language_analyses.tp_plan_id and p.submitted_at is null)
);

create policy "tp_language_analyses: trainer manages in their course"
on public.tp_language_analyses for all
to authenticated
using (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_language_analyses.tp_plan_id and p.course_id = public.current_course_id())
)
with check (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_language_analyses.tp_plan_id and p.course_id = public.current_course_id())
);

create policy "tp_language_analyses: admin manages in their center"
on public.tp_language_analyses for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_language_analyses.tp_plan_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_language_analyses.tp_plan_id and c.center_id = public.current_center_id()
  )
);

-- ---------- tp_materials ----------

create policy "tp_materials: trainee reads their own"
on public.tp_materials for select
to authenticated
using (trainee_id = auth.uid());

create policy "tp_materials: trainee manages their own while plan unsubmitted"
on public.tp_materials for all
to authenticated
using (
  trainee_id = auth.uid()
  and exists (select 1 from public.tp_plans p where p.id = tp_materials.tp_plan_id and p.submitted_at is null)
)
with check (
  trainee_id = auth.uid()
  and exists (select 1 from public.tp_plans p where p.id = tp_materials.tp_plan_id and p.submitted_at is null)
);

create policy "tp_materials: trainer manages in their course"
on public.tp_materials for all
to authenticated
using (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_materials.tp_plan_id and p.course_id = public.current_course_id())
)
with check (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_materials.tp_plan_id and p.course_id = public.current_course_id())
);

create policy "tp_materials: admin manages in their center"
on public.tp_materials for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_materials.tp_plan_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_materials.tp_plan_id and c.center_id = public.current_center_id()
  )
);

-- ---------- tp_self_evaluations ----------

create policy "tp_self_evaluations: trainee reads their own"
on public.tp_self_evaluations for select
to authenticated
using (trainee_id = auth.uid());

create policy "tp_self_evaluations: trainee inserts their own once taught"
on public.tp_self_evaluations for insert
to authenticated
with check (
  trainee_id = auth.uid()
  and exists (
    select 1 from public.plan_assignments pa
    where pa.trainee_id = tp_self_evaluations.trainee_id
      and pa.tp_number = tp_self_evaluations.tp_number
      and pa.taught_at is not null
  )
);

create policy "tp_self_evaluations: trainee updates their own while unsubmitted"
on public.tp_self_evaluations for update
to authenticated
using (trainee_id = auth.uid() and submitted_at is null)
with check (trainee_id = auth.uid());

create policy "tp_self_evaluations: trainer manages in their course"
on public.tp_self_evaluations for all
to authenticated
using (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_self_evaluations.tp_plan_id and p.course_id = public.current_course_id())
)
with check (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_self_evaluations.tp_plan_id and p.course_id = public.current_course_id())
);

create policy "tp_self_evaluations: admin manages in their center"
on public.tp_self_evaluations for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_self_evaluations.tp_plan_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_self_evaluations.tp_plan_id and c.center_id = public.current_center_id()
  )
);

-- ---------- tp_feedback ----------
-- Trainee visibility requires BOTH their own self-evaluation and this
-- feedback row to be submitted -- "write yours before you read theirs",
-- enforced at the RLS level rather than just hidden in the UI.

create policy "tp_feedback: trainee reads once self-eval and feedback are both submitted"
on public.tp_feedback for select
to authenticated
using (
  trainee_id = auth.uid()
  and submitted_at is not null
  and exists (
    select 1 from public.tp_self_evaluations se
    where se.tp_plan_id = tp_feedback.tp_plan_id and se.submitted_at is not null
  )
);

create policy "tp_feedback: trainer manages in their course"
on public.tp_feedback for all
to authenticated
using (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_feedback.tp_plan_id and p.course_id = public.current_course_id())
)
with check (
  public.is_trainer()
  and exists (select 1 from public.tp_plans p where p.id = tp_feedback.tp_plan_id and p.course_id = public.current_course_id())
);

create policy "tp_feedback: admin manages in their center"
on public.tp_feedback for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_feedback.tp_plan_id and c.center_id = public.current_center_id()
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.tp_plans p
    join public.courses c on c.id = p.course_id
    where p.id = tp_feedback.tp_plan_id and c.center_id = public.current_center_id()
  )
);

-- ============================================================
-- Storage: private bucket for trainee-uploaded TP materials.
-- Path convention: {center_id}/{trainee_id}/{tp_plan_id}/{filename} -- the
-- app must construct storage_path this way for the policies below to work.
-- Unlike coursebook-pdfs (trainer/admin only), trainees upload directly
-- from the browser here (same 1MB server-action body cap reasoning as
-- coursebook-upload-form.tsx), so they get their own scoped policy too.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('tp-materials', 'tp-materials', false);

create policy "tp-materials: trainee manages their own files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'tp-materials'
  and (storage.foldername(name))[1] = public.current_center_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'tp-materials'
  and (storage.foldername(name))[1] = public.current_center_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "tp-materials: trainer/admin manage their center's files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'tp-materials'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
)
with check (
  bucket_id = 'tp-materials'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
);
