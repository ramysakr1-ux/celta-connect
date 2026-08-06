-- Real gap found live-testing the staff chat coworker picker (2026-08-05):
-- a trainer could never actually SELECT another trainer's profile row --
-- the only profiles-table SELECT policies are "read your own row", "trainer
-- reads TRAINEES on their course", and "admin reads everyone in centre".
-- There was never a policy letting one trainer see another trainer, or a
-- trainee see their own course's trainers. This silently emptied two
-- features that both filter profiles by role = 'trainer': the staff chat
-- "+" picker's coworker list (src/lib/staff-chat.ts) and the Course
-- Stream "Course Tutors" panel (src/app/portfolio/[traineeId]/page.tsx,
-- which was quietly showing "No tutors assigned yet" even when a trainer
-- genuinely was on the course).
create policy "profiles: course members can read trainers on their course"
on public.profiles for select
to authenticated
using (
  role = 'trainer'
  and course_id = public.current_course_id()
);
