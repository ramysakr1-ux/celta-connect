-- Voice notes in the trainee's notebook. Ramy, 12 Sep 2026: "should they
-- also have the option to record a voice note, since we already have that
-- option?" The recording is kept and playable; its transcript (the same
-- OpenAI transcription the volunteer sign-up and speaking task use) is the
-- note's text, editable like any other. Uploads and playback go through the
-- service role (signed URLs), so the bucket is private and the one object
-- policy is the trainee's own read of their own folder. Re-runnable.
alter table public.trainee_notes
  add column if not exists audio_path text,
  add column if not exists audio_duration_seconds integer;

insert into storage.buckets (id, name, public)
values ('trainee-notebook-audio', 'trainee-notebook-audio', false)
on conflict (id) do nothing;

drop policy if exists "trainee-notebook-audio: own folder" on storage.objects;
create policy "trainee-notebook-audio: own folder"
on storage.objects for select
to authenticated
using (
  bucket_id = 'trainee-notebook-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
