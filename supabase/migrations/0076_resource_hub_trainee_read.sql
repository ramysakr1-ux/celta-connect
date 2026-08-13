-- Found live while verifying: Coursebooks and Multimedia silently rendered
-- empty for a real trainee, even with real data present. 0075 widened the
-- STORAGE bucket policies (tp-audio, resource-hub-files) for trainee reads,
-- but missed that tp_coursebooks and tp_audio_library themselves were still
-- trainer/admin-only at the TABLE level -- the trainee's own session client
-- (src/app/portfolio/[traineeId]/resources/page.tsx runs these queries
-- un-elevated) got silently empty results, not an error, so nothing
-- surfaced until checked live. Neither table holds anything sensitive
-- (a coursebook's title/level, an audio track's filename) -- same-centre
-- read is fine, matching the storage-level policies already added.
create policy "tp_coursebooks: same-center trainees can read"
on public.tp_coursebooks for select
to authenticated
using (center_id = public.current_center_id());

create policy "tp_audio_library: same-center trainees can read"
on public.tp_audio_library for select
to authenticated
using (center_id = public.current_center_id());

-- Same gap, one more table deep: the Coursebooks section also reads
-- course_tp_schedule (course -> which coursebook per TP number) to know
-- WHICH of the centre's coursebooks this trainee's own course actually
-- uses. Scoped to their own course, not centre-wide, since this table
-- (unlike the two above) is genuinely course-specific.
create policy "course_tp_schedule: trainees can read their own course's schedule"
on public.course_tp_schedule for select
to authenticated
using (course_id = public.current_course_id());
