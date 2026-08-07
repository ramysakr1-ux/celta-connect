-- for-claude-code.md items 3 and 4 (items 1 and 2 -- TP7/8 constraints and
-- the TP-group-of-six model -- turned out to already be resolved by earlier
-- migrations 0025 and 0047 respectively; see the reply to Ramy, not a
-- migration here).

-- ------------------------------------------------------------------
-- Item: late submission is currently impossible. submit_assignment_round
-- (0049) raises and refuses when due_date < current_date, so a candidate
-- an hour late cannot submit at all and the conversation happens offline
-- with no record. Fix: allow it, mark it late, let the tutor decide --
-- exactly the requested behaviour. Resubmissions already have no deadline
-- enforcement anywhere (no resubmission_due_date column exists, and the
-- RPC's resubmission branch never checked one), so nothing changes there.
-- ------------------------------------------------------------------

alter table public.assignments
  add column first_submitted_late boolean not null default false;

create or replace function public.submit_assignment_round(
  p_assignment_id uuid,
  p_word_count int,
  p_ai_declared boolean,
  p_ai_conversation_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_status public.submission_status;
  v_resubmission_status public.submission_status;
  v_due_date date;
begin
  if p_word_count < 750 or p_word_count > 1000 then
    raise exception 'This assignment must be between 750 and 1,000 words (currently %).', p_word_count;
  end if;

  if p_ai_declared and coalesce(trim(p_ai_conversation_url), '') = '' then
    raise exception 'You declared AI use -- add the conversation link before submitting.';
  end if;

  select first_status, resubmission_status, due_date
    into v_first_status, v_resubmission_status, v_due_date
  from public.assignments
  where id = p_assignment_id and trainee_id = auth.uid();

  if not found then
    raise exception 'Assignment not found.';
  end if;

  if v_first_status = 'not_submitted' then
    update public.assignments
    set first_status = 'submitted', first_submitted_at = now(),
        first_submitted_late = (v_due_date is not null and v_due_date < current_date),
        first_ai_declared = p_ai_declared,
        first_ai_conversation_url = nullif(trim(p_ai_conversation_url), '')
    where id = p_assignment_id;
  elsif v_first_status = 'resubmission_required' and v_resubmission_status = 'not_submitted' then
    update public.assignments
    set resubmission_status = 'submitted', resubmission_submitted_at = now(),
        resubmission_ai_declared = p_ai_declared,
        resubmission_ai_conversation_url = nullif(trim(p_ai_conversation_url), '')
    where id = p_assignment_id;
  else
    raise exception 'This assignment is not awaiting submission.';
  end if;
end;
$$;

-- ------------------------------------------------------------------
-- Item: assignment_type is a closed 4-value CHECK constraint on both
-- `assignments` and `assignment_templates`. The plagiarism reflection (a
-- centre sanction, specs/build-spec.md) and conflated assignments both
-- need a fifth-or-more value to exist, and the note's own suggestion is
-- "better as a per-centre row than a constraint."
--
-- Scoped narrowly here: this migration only removes the database-level
-- wall and gives future types a real home. It deliberately does NOT touch
-- the TypeScript side (AssignmentTypeValue, ASSIGNMENT_INFO,
-- ASSIGNMENT_CRITERIA, DEFAULT_SECTION_SKELETONS -- all still exactly the
-- 4 real Cambridge types) or build the plagiarism-reflection feature
-- itself, since that's a real feature with its own marking flow and UI,
-- not a schema fix. When that feature is designed, the schema is already
-- ready and won't need a second migration.
--
-- `assignment_type_definitions` rows with center_id null are the 4
-- Cambridge types, available to every centre. A centre-specific row (e.g.
-- a plagiarism reflection) gets a real center_id and
-- counts_toward_pass = false, so a future "3 of 4 must pass" calculator
-- can filter on this column instead of assuming every row counts.
--
-- course_timetable_events.linked_assignment_type already has no CHECK
-- constraint (confirmed in 0026) -- this brings assignments/
-- assignment_templates in line with that existing precedent rather than
-- inventing a new pattern.
-- ------------------------------------------------------------------

create table public.assignment_type_definitions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid references public.centers (id) on delete cascade,
  code text not null,
  title text not null,
  counts_toward_pass boolean not null default true,
  created_at timestamptz not null default now(),
  unique (center_id, code)
);

comment on column public.assignment_type_definitions.center_id is
  'null = the 4 standard Cambridge types, available to every centre. Set = a centre-specific type (e.g. a plagiarism reflection).';

insert into public.assignment_type_definitions (center_id, code, title, counts_toward_pass) values
  (null, 'Focus on Learner', 'Focus on the Learner', true),
  (null, 'LRT', 'Language Related Tasks', true),
  (null, 'Skills', 'Language Skills Related Tasks', true),
  (null, 'LfC', 'Lessons from the Classroom', true);

alter table public.assignments drop constraint if exists assignments_assignment_type_check;
alter table public.assignment_templates drop constraint if exists assignment_templates_assignment_type_check;

alter table public.assignment_type_definitions enable row level security;

create policy "assignment_type_definitions: everyone in the center reads the standard 4 plus their center's own"
on public.assignment_type_definitions for select
to authenticated
using (center_id is null or center_id = public.current_center_id());

create policy "assignment_type_definitions: admin manages their center's own types"
on public.assignment_type_definitions for all
to authenticated
using (public.is_admin() and center_id = public.current_center_id())
with check (public.is_admin() and center_id = public.current_center_id());
