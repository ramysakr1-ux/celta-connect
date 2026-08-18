-- Marking Guidance (design_handoff_teaching_and_assignments/assignments,
-- 2026-08-17). "There is no answer key. There is a line, and it needs to be
-- in the same place for everyone." -- the centre's own standardisation
-- reference, written by tutors, kept beside each criterion while marking.
--
-- Centre-scoped, not course-scoped: standardisation accumulates across
-- cohorts ("agreed February 2026 after a split decision" in the design
-- reference), so it should outlive any one course the same way
-- assignment_type_definitions and assignment_templates already do.
--
-- Any tutor can write here (not MCT-gated) -- README: "written by the
-- centre's own tutors at standardisation meetings", plural, collaborative.
-- assignment_type/criterion_key are free text keyed against
-- src/lib/assignment-criteria.ts's ASSIGNMENT_CRITERIA, not a foreign key --
-- that file is hardcoded Cambridge wording (see its own comment), so there's
-- no DB table to reference.

create table if not exists public.marking_guidance_entries (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  assignment_type text not null,
  criterion_key text not null,
  -- Each "one per line" -- same convention as celta5_records
  -- provisional_upgrade_conditions (grades-report), rendered as a bullet
  -- list rather than free prose.
  met_text text,
  grey_text text,
  not_text text,
  -- The single agreed line -- prose, not a list.
  agreed_text text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  unique (center_id, assignment_type, criterion_key)
);

alter table public.marking_guidance_entries enable row level security;

drop policy if exists "marking_guidance_entries: trainers read and write their centre's guidance" on public.marking_guidance_entries;
create policy "marking_guidance_entries: trainers read and write their centre's guidance"
on public.marking_guidance_entries for all
to authenticated
using (public.is_trainer() and center_id = public.current_center_id())
with check (public.is_trainer() and center_id = public.current_center_id());
