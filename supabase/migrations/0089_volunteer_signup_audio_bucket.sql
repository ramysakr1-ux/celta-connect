-- Storage for volunteer sign-up audio recordings (FOL's "signup_recording"
-- claim source). Volunteers never get a real Supabase session (same as
-- every other volunteer-facing write, e.g. materials/attendance) -- the
-- upload happens server-side via the admin client from a token-validated
-- server action, not a direct browser->Storage upload, so no
-- "authenticated" RLS policy can apply to the writer. Trainer/admin get
-- read access for playback (Volunteer Sign-Up.dc.html not yet built, but
-- staff will want to listen when writing a manual transcript in the
-- meantime -- see [[project_fol_pooled_evidence]]).
insert into storage.buckets (id, name, public)
values ('volunteer-signup-audio', 'volunteer-signup-audio', false)
on conflict (id) do nothing;

create policy "volunteer-signup-audio: trainer/admin read their centre's"
on storage.objects for select
to authenticated
using (
  bucket_id = 'volunteer-signup-audio'
  and (public.is_trainer() or public.is_admin())
  and (storage.foldername(name))[1] = public.current_center_id()::text
);
