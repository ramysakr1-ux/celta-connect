-- Checkpoint 12 (build-spec.md item 18): the pre-course task submission
-- mechanism. The real content is Cambridge's copyrighted Pre-Course Task,
-- (C) UCLES 2018 ("five sections... serve it as-is; never rewrite it") plus
-- a centre-authored supplement (online teaching, use of L1) -- neither is
-- something this migration invents. Seeds clearly-marked placeholder
-- sections so the mechanism is testable now; Ramy swaps in the real
-- content later (a data update, not new code).
--
-- Deliberately ungraded -- no grade/status column on the response table at
-- all, matching "ungraded, handed in on day one."

create table public.pre_course_task_sections (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  source text not null check (source in ('cambridge', 'centre_supplement')),
  sequence_index smallint not null,
  title text not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, source, sequence_index)
);

create index pre_course_task_sections_center_id_idx on public.pre_course_task_sections (center_id);

create table public.pre_course_task_responses (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  section_id uuid not null references public.pre_course_task_sections (id) on delete cascade,
  response text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (trainee_id, section_id)
);

create index pre_course_task_responses_course_id_idx on public.pre_course_task_responses (course_id);
create index pre_course_task_responses_trainee_id_idx on public.pre_course_task_responses (trainee_id);

alter table public.pre_course_task_sections enable row level security;
alter table public.pre_course_task_responses enable row level security;

-- Sections: same shape as resources -- everyone in the center reads,
-- trainer/admin manage.
create policy "pre_course_task_sections: members can read their center's sections"
on public.pre_course_task_sections for select
to authenticated
using (center_id = public.current_center_id());

create policy "pre_course_task_sections: trainer/admin manage their center's sections"
on public.pre_course_task_sections for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and center_id = public.current_center_id()
);

-- Responses: a trainee manages only their own; trainer reads their course's
-- (aggregate view), matching the exact pattern already used for
-- attendance_absences/observations elsewhere in this schema.
create policy "pre_course_task_responses: trainee manages their own responses"
on public.pre_course_task_responses for all
to authenticated
using (trainee_id = auth.uid())
with check (trainee_id = auth.uid());

create policy "pre_course_task_responses: trainer reads their course's responses"
on public.pre_course_task_responses for select
to authenticated
using (public.is_trainer() and course_id = public.current_course_id());

-- Seed placeholder content for the one center that exists today, so the
-- mechanism is immediately testable. Clearly marked as placeholder in the
-- prompt text itself, not presented as real Cambridge/centre content.
insert into public.pre_course_task_sections (center_id, source, sequence_index, title, prompt)
select c.id, 'cambridge', s.idx, s.title, '[PLACEHOLDER -- replace with the real UCLES 2018 Pre-Course Task text for this section before candidates see it.]'
from public.centers c
cross join (values
  (1, 'Unit 1 -- Learners and teachers, and the teaching and learning context'),
  (2, 'Unit 2 -- Language analysis and awareness'),
  (3, 'Unit 3 -- Language skills: reading, listening, speaking and writing'),
  (4, 'Unit 4 -- Planning and resources for different teaching contexts'),
  (5, 'Unit 5 -- Developing teaching skills and professionalism')
) as s(idx, title);

insert into public.pre_course_task_sections (center_id, source, sequence_index, title, prompt)
select c.id, 'centre_supplement', s.idx, s.title, '[PLACEHOLDER -- write your own short task here before candidates see it.]'
from public.centers c
cross join (values
  (1, 'Teaching online'),
  (2, 'Using L1 in the classroom')
) as s(idx, title);
