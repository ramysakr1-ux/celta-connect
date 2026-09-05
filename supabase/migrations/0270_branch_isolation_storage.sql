-- Files follow the same rule as rows: every branch this person holds.
--
-- 0269 rewrote the public-schema policies; these eleven live on
-- storage.objects and were missed because that dump looked only at the
-- public schema. File paths start with the centre id as their first folder
-- (coursebook PDFs, TP materials, briefs, audio, resource hub, volunteer
-- sign-up audio, speaking tasks, special-consideration evidence), so the
-- comparison is against the held centres as text.

create or replace function public.held_center_ids_text()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(x::text), '{}'::text[]) from unnest(public.held_center_ids()) x;
$$;

alter policy "applicant-speaking-task-audio: admissions staff read their cent" on storage.objects
  using (((bucket_id = 'applicant-speaking-task-audio'::text) AND can_handle_admissions() AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "assignment-briefs: trainer/admin manage their center's briefs" on storage.objects
  using (((bucket_id = 'assignment-briefs'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))))
  with check (((bucket_id = 'assignment-briefs'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "coursebook-pdfs: trainer/admin manage their center's PDFs" on storage.objects
  using (((bucket_id = 'coursebook-pdfs'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))))
  with check (((bucket_id = 'coursebook-pdfs'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "resource-hub-files: same-center trainees can read" on storage.objects
  using (((bucket_id = 'resource-hub-files'::text) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "resource-hub-files: trainer/admin manage their center's files" on storage.objects
  using (((bucket_id = 'resource-hub-files'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))))
  with check (((bucket_id = 'resource-hub-files'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "special-consideration-evidence: staff read their centre's" on storage.objects
  using (((bucket_id = 'special-consideration-evidence'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "tp-audio: same-center trainees can read" on storage.objects
  using (((bucket_id = 'tp-audio'::text) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "tp-audio: trainer/admin manage their center's audio files" on storage.objects
  using (((bucket_id = 'tp-audio'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))))
  with check (((bucket_id = 'tp-audio'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "tp-materials: trainee manages their own files" on storage.objects
  using (((bucket_id = 'tp-materials'::text) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text())) AND ((storage.foldername(name))[2] = (auth.uid())::text)))
  with check (((bucket_id = 'tp-materials'::text) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text())) AND ((storage.foldername(name))[2] = (auth.uid())::text)));

alter policy "tp-materials: trainer/admin manage their center's files" on storage.objects
  using (((bucket_id = 'tp-materials'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))))
  with check (((bucket_id = 'tp-materials'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));

alter policy "volunteer-signup-audio: trainer/admin read their centre's" on storage.objects
  using (((bucket_id = 'volunteer-signup-audio'::text) AND (is_trainer() OR is_admin()) AND ((storage.foldername(name))[1] = any(public.held_center_ids_text()))));
