-- The centre's own ticks against Administration Handbook 14.1.
--
-- Ramy, 6 Sep 2026: "maybe you should have an enforced checklist... a warning
-- that so and so is still missing, with a potential override."
--
-- Until now that list was fifteen items of prose with no state: Connect could
-- not tell whether a centre had its candidate agreements ready, so it could
-- not warn anyone. Meanwhile the ONLY thing that blocked handing the pack over
-- was portfolio completeness, which is not even on 14.1's list -- so a centre
-- could send an assessor a pack with no candidate descriptions, no attendance
-- registers and no previous assessor's report, and nothing said a word.
--
-- Roughly a third of the list Connect can answer for itself (the timetable
-- exists, the assignment titles are published, the Appian reference is set).
-- The rest only the centre knows, and those are what this table holds.
--
-- Append-only, like assessor_observation_choices: a tick and a later untick
-- are two rows, and the current state is the newest row for that item. More
-- than one person can act on a course's assessor preparation -- the MCT and
-- Course Admin both -- so "shared access leaves a footprint" applies: who,
-- what, and when, never overwritten.

create table if not exists public.assessor_prep_marks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,

  -- CentrePreparationItem.key (src/lib/assessor-requirements.ts). Text rather
  -- than an enum on purpose: the Handbook's list changes with its editions,
  -- and a new item should not need a migration before a centre can tick it.
  item_key text not null check (length(btrim(item_key)) between 2 and 60),

  -- false is a real, recorded event -- someone deciding this is NOT ready
  -- after all, which is exactly the thing worth having a trail of.
  done boolean not null,

  marked_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists assessor_prep_marks_course_idx
  on public.assessor_prep_marks (course_id, item_key, created_at desc);

alter table public.assessor_prep_marks enable row level security;

-- Ramy's call: the MCT and Course Admin both tick. Half the list is Course
-- Admin's work anyway -- candidate agreements, the application task, the
-- attendance registers -- so gating it on the MCT alone would have the person
-- who did the work unable to say it was done.
create policy assessor_prep_marks_read
  on public.assessor_prep_marks for select
  using (
    exists (
      select 1 from public.courses c
      where c.id = assessor_prep_marks.course_id
        and c.center_id = any (public.held_center_ids())
    )
  );

create policy assessor_prep_marks_insert
  on public.assessor_prep_marks for insert
  with check (
    marked_by = (select auth.uid())
    and exists (
      select 1 from public.courses c
      where c.id = assessor_prep_marks.course_id
        and c.center_id = any (public.held_center_ids())
    )
  );

-- No update, no delete: the history is the point.

notify pgrst, 'reload schema';
