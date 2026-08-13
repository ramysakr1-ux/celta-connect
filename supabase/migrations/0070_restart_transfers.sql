-- specs/build-spec.md §3 "First-half withdrawal with a restart -- Admin
-- Handbook 6.9, a separate case: a candidate forced to withdraw in the
-- first half may, at the centre's discretion, start a new course from the
-- beginning without paying a new fee, and can transfer any successful
-- assessment to the new course. Teaching starts again from TP1; passed
-- assignments carry. This is not a deferral and must not reuse the
-- deferral flow."
--
-- Two-sided, like a real restart is: the source side (this migration) is
-- recorded the moment a trainer/admin marks someone eligible, well before
-- any destination course exists. carried_assignments is a frozen JSONB
-- snapshot taken at that moment -- not a live reference to the source
-- assignments rows, since "everything freezes as it stands" and the source
-- course could later be exported/wiped at close-out (not yet built, but
-- this shouldn't need to know about that when it lands). The destination
-- side links later once the candidate actually joins a new course.
create table public.restart_transfers (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id),
  source_trainee_id uuid not null references public.profiles(id),
  source_course_id uuid not null references public.courses(id),
  -- [{ assignment_type, content_grade, english_grade, marker_id, tutor_feedback, submitted_at, source_assignment_id }, ...]
  carried_assignments jsonb not null default '[]',
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  destination_trainee_id uuid references public.profiles(id),
  destination_course_id uuid references public.courses(id),
  linked_at timestamptz,
  linked_by uuid references public.profiles(id)
);

create index restart_transfers_center_id_idx on public.restart_transfers (center_id);
create index restart_transfers_source_trainee_id_idx on public.restart_transfers (source_trainee_id);

alter table public.restart_transfers enable row level security;

-- Same shape as submission_text_fingerprints (0063): select-only for
-- trainer/admin in the centre, writes go through the admin client from the
-- server actions on both sides (source course and destination course can
-- legitimately differ, so there's no single current_course_id() that would
-- correctly gate a with-check for both writers).
create policy "restart_transfers: trainer/admin read their centre's transfers"
on public.restart_transfers for select
to authenticated
using ((public.is_trainer() or public.is_admin()) and center_id = public.current_center_id());
