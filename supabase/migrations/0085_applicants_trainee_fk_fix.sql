-- Found live while cleaning up test data: applicants.resulting_trainee_id
-- referenced profiles(id) with no ON DELETE behavior (defaults to
-- RESTRICT). Confirmed this blocks deleting the profile/auth user while
-- the applicant row still points at it -- which is exactly what the
-- course close-out wipe (src/lib/course-close-out/wipe.ts,
-- auth.admin.deleteUser per trainee) would hit for any course where an
-- accepted former-applicant is among the trainees being wiped. The
-- applicant record should survive the trainee account being deleted
-- later (accepted_at is the historical fact; the live link is a
-- convenience, not something that needs to block deletion), so this
-- matches every other "who did this" reference column in the schema
-- (created_by, rejected_by, etc.) in using on delete set null.
alter table public.applicants drop constraint applicants_resulting_trainee_id_fkey;
alter table public.applicants
  add constraint applicants_resulting_trainee_id_fkey
  foreign key (resulting_trainee_id) references public.profiles (id) on delete set null;
