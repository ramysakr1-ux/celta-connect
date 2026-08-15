-- specs/build-spec.md §7 mobile scope: "Trainer -- capture, not marking.
-- Points typed or dictated during a TP, tagged and timestamped against the
-- right candidate, appearing in the feedback form on the laptop." There is
-- no "TP happening live right now" concept anywhere in this schema
-- (plan_assignments.taught_at is a simple after-the-fact flag, not a
-- start/end-timed session) -- rather than inventing a live-session state
-- machine, the trainer picks the candidate + TP number manually when
-- capturing, same as they already do everywhere else in the app. These
-- rows are draft/scratch material, never trainee-visible, never merged
-- automatically into tp_feedback -- a trainer explicitly pulls each one in
-- via the feedback form later (see feedback-form.tsx's captured-notes panel).

create table public.tp_capture_notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  tp_number smallint not null check (tp_number between 1 and 8),
  text text not null,
  criteria_codes text[] not null default '{}',
  captured_at timestamptz not null default now()
);

create index tp_capture_notes_trainee_tp_idx on public.tp_capture_notes (trainee_id, tp_number);
create index tp_capture_notes_course_id_idx on public.tp_capture_notes (course_id);

alter table public.tp_capture_notes enable row level security;

create policy "tp_capture_notes: trainer/admin manage notes in their course"
on public.tp_capture_notes for all
to authenticated
using (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
)
with check (
  (public.is_trainer() or public.is_admin())
  and course_id = public.current_course_id()
);
