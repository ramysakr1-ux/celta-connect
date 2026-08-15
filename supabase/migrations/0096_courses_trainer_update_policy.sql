-- Real, pre-existing bug found while verifying the Announcements auto-
-- generation trigger ("fire the moment the timetable is published"):
-- `courses` has exactly one write-capable RLS policy in the whole
-- migration history (0001, admin-only, "courses: admins manage courses in
-- their center"). There has never been a trainer UPDATE policy on this
-- table at all. Confirmed live against a real trainer session (not
-- service-role): updating courses.timetable_locked_at returned
-- `{ error: null, count: 0 }` -- RLS silently drops the write, no
-- exception, so it has looked like it "worked" (200 response, no error
-- surfaced to the trainer) while never actually persisting.
--
-- This means setTimetableLock, setTimeBands, and resetTimeBands
-- (src/app/trainer/(hub)/timetable/actions.ts) -- all three trainer-facing
-- actions on the Timetable page's "Lock timetable" and "Time bands"
-- controls -- have never been able to take effect for a trainer session,
-- only an admin one. Scoped narrowly (UPDATE only, not full "for all" --
-- trainers still can't create or delete course rows, only admins can).
create policy "courses: trainer updates their own course"
on public.courses for update
to authenticated
using (public.is_trainer() and id = public.current_course_id())
with check (public.is_trainer() and id = public.current_course_id());
