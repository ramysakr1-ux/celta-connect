-- specs/build-spec.md "Peer observation -- the shared sheet". "Needs a
-- peer_observations table; nothing in the current build has one." Two
-- tables: one sheet per taught lesson (the prompts, the reveal gate, the
-- group feedback agreed by the day's non-teaching half), and one note row
-- per observer (the five who aren't teaching that lesson).
--
-- Deliberately excluded everywhere else in the app by design, not by
-- omission: "Peer observation is excluded from CELTA 5, the portfolio, the
-- grade review, the assessor pack, and the close-out export." Nothing here
-- is referenced by any of those; keep it that way.
create table public.peer_observation_sheets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 8),
  plan_assignment_id uuid references public.plan_assignments(id) on delete set null,
  -- Seeded from criteriaForTpDate() at creation time -- input session ->
  -- criterion -> TP point -> peer task -> TP feedback, same criterion the
  -- tutor marks on this candidate's own lesson.
  criteria_codes text[] not null default '{}',
  prompt_1 text not null,
  prompt_2 text not null,
  -- "The feedback slot on the timetable reveals every note at once... the
  -- tutor may open it early." A manual trainer action (see rotation running-
  -- order panel), not a timetable-time gate.
  revealed_at timestamptz,
  revealed_by uuid references public.profiles(id),
  -- "The three who did not teach today read all the notes and agree the
  -- group feedback." One shared, collaboratively-agreed entry per lesson.
  group_feedback text,
  group_feedback_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trainee_id, tp_number)
);

create index peer_observation_sheets_course_id_idx on public.peer_observation_sheets (course_id);

create table public.peer_observation_notes (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.peer_observation_sheets(id) on delete cascade,
  observer_id uuid not null references public.profiles(id) on delete cascade,
  -- "Two prompts per note, never more, and both are single-line boxes...
  -- cap each at roughly 140 characters." Enforced in the UI (maxLength) and
  -- here as a hard backstop, not the primary UX signal.
  note_1 text check (char_length(note_1) <= 200),
  note_2 text check (char_length(note_2) <= 200),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sheet_id, observer_id)
);

create trigger set_updated_at before update on public.peer_observation_notes
for each row execute function public.set_updated_at();

alter table public.peer_observation_sheets enable row level security;
alter table public.peer_observation_notes enable row level security;

create policy "peer_observation_sheets: trainer/admin manage sheets in their course"
on public.peer_observation_sheets for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id())
with check ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id());

-- The observed candidate reads their own sheet, but only once revealed --
-- "notes are private while being written". Creation, reveal, and any
-- cross-group visibility (a peer's OWN unrevealed note doesn't count as
-- "the sheet" being visible to them) all go through server actions using
-- the admin client with their own explicit authorization checks, same
-- pattern as withdrawTrainee/markForDeferral this session -- not attempted
-- here as an RLS predicate, since "is one of the other five members of
-- this trainee's paired TP group" isn't expressible without a multi-table
-- subquery that would need re-deriving (and re-trusting) rotation logic
-- inside a policy.
create policy "peer_observation_sheets: candidate reads their own once revealed"
on public.peer_observation_sheets for select
to authenticated
using (trainee_id = auth.uid() and revealed_at is not null);

-- An observer's own note rows only, ever -- this is the real privacy floor
-- ("private while being written"). Nobody, including the observed
-- candidate, can select another observer's row through this policy; the
-- post-reveal compiled view is served by the admin client from the TP
-- page after its own eligibility check.
create policy "peer_observation_notes: observer manages their own notes"
on public.peer_observation_notes for all
to authenticated
using (observer_id = auth.uid())
with check (observer_id = auth.uid());

create policy "peer_observation_notes: trainer/admin manage notes in their course"
on public.peer_observation_notes for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.peer_observation_sheets s
    where s.id = peer_observation_notes.sheet_id and s.course_id = public.current_course_id()
  )
)
with check (
  (public.is_trainer() or public.is_admin())
  and exists (
    select 1 from public.peer_observation_sheets s
    where s.id = peer_observation_notes.sheet_id and s.course_id = public.current_course_id()
  )
);
