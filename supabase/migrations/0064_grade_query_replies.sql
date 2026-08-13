-- build-spec.md "Grade query -- the reply before an appeal" / running-a-
-- course.md "A candidate queries their grade". A candidate emails asking
-- why they got a Pass and not a Pass B (or similar); a tutor generates a
-- reply drawn entirely from the record -- grade descriptors, TP outcomes,
-- criteria met, assignment rounds, tutorial dates, the provisional slash
-- justification -- then writes two sentences themselves (what would have
-- made the difference, what happens next) and files it.
--
-- "Generated but never sent automatically... filed with the course" means
-- this is a snapshot, not a live-recomputed view: evidence_snapshot is
-- captured once, at generation time, and never updated afterwards even if
-- the underlying celta5_records/tp_feedback/assignments rows change later
-- -- otherwise a filed reply could silently stop matching what the
-- candidate was actually told. The two tutor-authored paragraphs and
-- filed_at/filed_by are the only columns that change after insert (while
-- filed_at is still null -- see below).
--
-- filed_at stays null until the trainer takes the explicit "File" action --
-- same "everything is a trainer action, nothing auto-happens" shape as
-- celta5_records (trainer_signoff_final_at, final_report_released_at).
-- Before filing, the row is still an editable draft (a trainer can
-- generate, look at the assembled evidence, redraft the two paragraphs,
-- come back later); once filed_at is set the UI treats it as read-only --
-- "the tutor edits it and effectively signs it by choosing to release/file
-- it" -- enforced at the UI/action layer like every other sign-off in this
-- table's family, not a DB constraint, since a genuinely mistaken filing
-- still needs to stay correctable by a human, not deleted.
--
-- No trainee access at all (staff-facing evidence assembly, not a
-- candidate-facing feature -- the spec never has the candidate opening
-- this in-app, only receiving the resulting email). Matches the
-- malpractice_cases policy shape (0063): trainer/admin, scoped to their
-- current course. No assessor-read
-- policy yet -- there is no distinct "assessor pack" feature in this
-- codebase today (grades-report's own assessor access goes through a
-- tokenized course_access_tokens link + admin client, see
-- getAssessorCourseId() / src/lib/auth/portfolio-access.ts) -- but
-- course_id/trainee_id scoping here is deliberately the same shape as
-- celta5_records so a future assessor-pack feature can read this table the
-- same way it will eventually read everything else.

create table public.grade_query_replies (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  generated_by uuid not null references public.profiles (id),
  generated_at timestamptz not null default now(),
  -- Snapshot at generation time -- grade awarded + descriptors, TP outcomes,
  -- criteria met/not-met, assignment rounds, tutorial dates, provisional
  -- slash justification. Shape owned by the app layer (see
  -- src/lib/grade-query-reply.ts), not enforced in SQL.
  evidence_snapshot jsonb not null,
  what_would_have_made_the_difference text,
  what_happens_next text,
  filed_at timestamptz,
  filed_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create index grade_query_replies_course_id_idx on public.grade_query_replies (course_id);
create index grade_query_replies_trainee_id_idx on public.grade_query_replies (trainee_id);

alter table public.grade_query_replies enable row level security;

create policy "grade_query_replies: trainer/admin manage replies in their course"
on public.grade_query_replies for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id())
with check ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id());

create trigger set_updated_at before update on public.grade_query_replies
for each row execute function public.set_updated_at();
