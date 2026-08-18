-- Feedback Assist (design_handoff_feedback_assist, 2026-08-17). Replaces the
-- centre-wide tone setting for TP feedback specifically -- the MCT sets a
-- course-wide default (their own rows), every other tutor reads it live
-- until they save their own edit, at which point their copy becomes
-- independent. No cross-course carryover: Ramy, 2026-08-17, "reset per
-- course", matching Course Admin's "everything about a person is
-- course-level and leaves at close-out." Assignment feedback's existing
-- centre-wide feedback_style_examples (migration 0020) is untouched -- this
-- handoff only covers TP feedback (see README's Screens list).

create table if not exists public.feedback_assist_settings (
  course_id uuid not null references public.courses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  -- Set the moment this tutor first saves their own examples. Null means
  -- "still following the MCT's default" -- reads for this tutor resolve to
  -- the MCT's live rows, so a later MCT edit is picked up automatically with
  -- no propagation job needed. Once set, this tutor's own rows are used
  -- instead, and MCT edits no longer reach them.
  customized_at timestamptz,
  primary key (course_id, profile_id)
);

create table if not exists public.feedback_assist_examples (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tone text not null check (tone in ('direct', 'supportive')),
  example_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_assist_examples_lookup_idx
  on public.feedback_assist_examples (course_id, profile_id, tone);

alter table public.feedback_assist_settings enable row level security;
alter table public.feedback_assist_examples enable row level security;

-- Settings are personal -- no one else needs to read whether a tutor has the
-- tone icon on.
drop policy if exists "feedback_assist_settings: trainer manages their own setting" on public.feedback_assist_settings;
create policy "feedback_assist_settings: trainer manages their own setting"
on public.feedback_assist_settings for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id() and profile_id = auth.uid())
with check (public.is_trainer() and course_id = public.current_course_id() and profile_id = auth.uid());

-- Examples need course-wide SELECT so an uncustomized tutor can read the
-- MCT's rows, but writes stay scoped to the tutor's own copy.
drop policy if exists "feedback_assist_examples: trainer reads course examples" on public.feedback_assist_examples;
create policy "feedback_assist_examples: trainer reads course examples"
on public.feedback_assist_examples for select
to authenticated
using (public.is_trainer() and course_id = public.current_course_id());

drop policy if exists "feedback_assist_examples: trainer inserts their own examples" on public.feedback_assist_examples;
create policy "feedback_assist_examples: trainer inserts their own examples"
on public.feedback_assist_examples for insert
to authenticated
with check (public.is_trainer() and course_id = public.current_course_id() and profile_id = auth.uid());

drop policy if exists "feedback_assist_examples: trainer updates their own examples" on public.feedback_assist_examples;
create policy "feedback_assist_examples: trainer updates their own examples"
on public.feedback_assist_examples for update
to authenticated
using (public.is_trainer() and course_id = public.current_course_id() and profile_id = auth.uid())
with check (public.is_trainer() and course_id = public.current_course_id() and profile_id = auth.uid());

drop policy if exists "feedback_assist_examples: trainer deletes their own examples" on public.feedback_assist_examples;
create policy "feedback_assist_examples: trainer deletes their own examples"
on public.feedback_assist_examples for delete
to authenticated
using (public.is_trainer() and course_id = public.current_course_id() and profile_id = auth.uid());
