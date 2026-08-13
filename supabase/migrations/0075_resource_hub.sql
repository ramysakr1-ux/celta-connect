-- specs/build-spec.md "Replace the Audio Library tab with a Resource hub
-- tab... six sections: TP points, coursebooks, multimedia, assignment
-- briefs, input sessions, centre documents" + the visibility table just
-- after it. TP points library, multimedia (audio), and assignment briefs
-- already have solid dedicated tables/pages and stay exactly as they are,
-- just linked from the new hub. This migration covers what's actually new:
-- a "centre documents" category, real file/HTML upload (today `resources`
-- is link-only), and trainee read access to buckets that were trainer-only
-- until now that multimedia/input-sessions are meant to be trainee-visible.

-- 1. Widen resources.category for the new "centre documents" section.
alter table public.resources drop constraint resources_category_check;
alter table public.resources add constraint resources_category_check check (
  category in (
    'lesson_planning', 'teaching_practice', 'written_assignments', 'cambridge_documentation',
    'reading', 'input_sessions', 'filmed_observations', 'admissions', 'centre_documents'
  )
);

-- 2. Real upload support -- storage_path for an uploaded file (PDF, or an
-- input session's self-contained .html), content_type distinguishing an
-- external link from an uploaded file from uploaded HTML meant to be
-- embedded live rather than downloaded. file_url becomes optional since an
-- uploaded item has no external URL; the check keeps exactly one of the
-- two populated.
alter table public.resources add column storage_path text;
alter table public.resources add column content_type text not null default 'link'
  check (content_type in ('link', 'file', 'html'));
alter table public.resources alter column file_url drop not null;
alter table public.resources add constraint resources_has_content check (
  file_url is not null or storage_path is not null
);

-- 3. Storage bucket for uploaded resource files (PDFs, and input-session
-- .html files served live in a sandboxed iframe). Private + folder-keyed by
-- center_id, same shape as tp-audio/assignment-briefs -- trainer/admin
-- manage, but ALSO readable by any authenticated same-center user (unlike
-- those two), since resources here are meant to be trainee-visible per the
-- app layer's own visible_to_trainee filter (which already runs before any
-- signed URL is ever requested -- this policy only needs to agree on
-- "same centre", not re-derive per-item visibility).
insert into storage.buckets (id, name, public)
values ('resource-hub-files', 'resource-hub-files', false)
on conflict (id) do nothing;

create policy "resource-hub-files: trainer/admin manage their center's files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'resource-hub-files'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
)
with check (
  bucket_id = 'resource-hub-files'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
);

create policy "resource-hub-files: same-center trainees can read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'resource-hub-files'
  and (storage.foldername(name))[1] = public.current_center_id()::text
);

-- 4. tp-audio was trainer/admin-only end to end -- multimedia is meant to
-- be trainee-visible now, so trainees need to be able to generate a signed
-- URL to actually play a track (see src/components/tp-audio/audio-list.tsx,
-- which calls createSignedUrl from the browser's own session).
create policy "tp-audio: same-center trainees can read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'tp-audio'
  and (storage.foldername(name))[1] = public.current_center_id()::text
);

-- 5. The new trainee-visible "Coursebooks" section is deliberately lighter
-- than the TP points library it's easy to confuse with -- just which book
-- and how to get it, not the staged point-by-point content underneath.
alter table public.tp_coursebooks add column access_notes text;
