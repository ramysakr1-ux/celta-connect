-- 0302 -- Appendices on a written assignment.
--
-- The candidate's assignment had an "Appendices" heading and one sentence
-- ("Anything you attach sits here") and no way whatsoever to attach anything.
-- Meanwhile the centre's own Focus on the Learner brief instructs them, in
-- two sections, to "Attach one task in Appendix 1" and "Appendix 2", and the
-- Skills assignment is analysis OF a text that had nowhere to live.
--
-- The syllabus (Dec 2022, printed p.18) makes both of these assessed, not
-- decorative:
--   2.1 Focus on the learner (d) -- "selecting appropriate material and/or
--       resources to aid the learner's/learners' language and/or skills
--       development"
--   2.3 Language skills related tasks -- subskills "practised and developed
--       using coursebook material or authentic text", and "task design in
--       relation to the text with brief rationale"
-- A tutor cannot mark task design in relation to a text they cannot see.
--
-- Path convention, matching tp-materials:
--   {center_id}/{trainee_id}/{assignment_id}/{filename}
-- The app must build storage_path this way or the storage policies refuse it.

create table if not exists public.assignment_appendices (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  -- Which round it was attached for. A resubmission may replace a wrong
  -- file without destroying the record of what was marked the first time.
  round text not null default 'first' check (round in ('first', 'resubmission')),
  -- "Appendix 1", "The text", or whatever the brief calls it. The brief asks
  -- for named appendices, so the name is the candidate's to set.
  label text,
  -- Exactly one of these two. A file in our bucket, or a link out (a centre
  -- on Google Drive already works this way for TP materials).
  storage_path text,
  link_url text,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint assignment_appendices_one_source check (
    (storage_path is not null and link_url is null)
    or (storage_path is null and link_url is not null)
  )
);

create index if not exists assignment_appendices_assignment_idx
  on public.assignment_appendices (assignment_id, round, created_at);

alter table public.assignment_appendices enable row level security;

-- Read: the candidate, always -- including after it locks, because the
-- portfolio has to keep showing what was submitted.
drop policy if exists "assignment_appendices: trainee reads their own" on public.assignment_appendices;
create policy "assignment_appendices: trainee reads their own"
on public.assignment_appendices for select
to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.trainee_id = (select auth.uid())
));

-- Write: the candidate, only while the round is open. Same locking test the
-- section responses use, so an appendix cannot be swapped after submission.
drop policy if exists "assignment_appendices: trainee attaches while unlocked" on public.assignment_appendices;
create policy "assignment_appendices: trainee attaches while unlocked"
on public.assignment_appendices for all
to authenticated
using (exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.trainee_id = (select auth.uid())
    and (a.first_status = 'not_submitted'::submission_status
      or (a.first_status = 'resubmission_required'::submission_status
          and a.resubmission_status = 'not_submitted'::submission_status))
))
with check (exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.trainee_id = (select auth.uid())
    and (a.first_status = 'not_submitted'::submission_status
      or (a.first_status = 'resubmission_required'::submission_status
          and a.resubmission_status = 'not_submitted'::submission_status))
));

drop policy if exists "assignment_appendices: trainer manages in their course" on public.assignment_appendices;
create policy "assignment_appendices: trainer manages in their course"
on public.assignment_appendices for all
to authenticated
using ((select public.is_trainer()) and exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.course_id = (select public.current_course_id())
))
with check ((select public.is_trainer()) and exists (
  select 1 from public.assignments a
  where a.id = assignment_appendices.assignment_id
    and a.course_id = (select public.current_course_id())
));

drop policy if exists "assignment_appendices: admin manages in their center" on public.assignment_appendices;
create policy "assignment_appendices: admin manages in their center"
on public.assignment_appendices for all
to authenticated
using ((select public.is_admin()) and exists (
  select 1 from public.assignments a
  join public.courses c on c.id = a.course_id
  where a.id = assignment_appendices.assignment_id
    and c.center_id = any (public.held_center_ids())
))
with check ((select public.is_admin()) and exists (
  select 1 from public.assignments a
  join public.courses c on c.id = a.course_id
  where a.id = assignment_appendices.assignment_id
    and c.center_id = any (public.held_center_ids())
));

-- ============================================================
-- Storage: the bucket, private, same shape as tp-materials and already
-- branch-isolated via held_center_ids_text().
-- ============================================================

insert into storage.buckets (id, name, public)
values ('assignment-appendices', 'assignment-appendices', false)
on conflict (id) do nothing;

drop policy if exists "assignment-appendices: trainee manages their own files" on storage.objects;
create policy "assignment-appendices: trainee manages their own files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'assignment-appendices'
  and (storage.foldername(name))[1] = any (public.held_center_ids_text())
  and (storage.foldername(name))[2] = (auth.uid())::text
)
with check (
  bucket_id = 'assignment-appendices'
  and (storage.foldername(name))[1] = any (public.held_center_ids_text())
  and (storage.foldername(name))[2] = (auth.uid())::text
);

drop policy if exists "assignment-appendices: trainer/admin manage their center's files" on storage.objects;
create policy "assignment-appendices: trainer/admin manage their center's files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'assignment-appendices'
  and ((select public.is_trainer()) or (select public.is_admin()))
  and (storage.foldername(name))[1] = any (public.held_center_ids_text())
)
with check (
  bucket_id = 'assignment-appendices'
  and ((select public.is_trainer()) or (select public.is_admin()))
  and (storage.foldername(name))[1] = any (public.held_center_ids_text())
);

notify pgrst, 'reload schema';

select
  (select count(*) from storage.buckets where id = 'assignment-appendices') as bucket,
  (select count(*) from pg_policies where tablename = 'assignment_appendices') as table_policies,
  (select count(*) from pg_policies where tablename = 'objects' and policyname like 'assignment-appendices%') as storage_policies;
