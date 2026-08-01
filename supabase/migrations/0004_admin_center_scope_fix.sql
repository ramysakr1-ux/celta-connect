-- Fix: the original tps/assignments/celta5_matrix/attendance policies
-- scoped admin access to the admin's own course_id (via current_course_id()),
-- but admins are meant to have cross-course oversight of their whole
-- center, not just one course. Trainers are correctly scoped to a single
-- course; only the admin branch needs fixing, to "any course in their
-- center" instead.

-- ---------- tps ----------

drop policy if exists "tps: trainer/admin can read TPs in their course" on public.tps;
drop policy if exists "tps: trainer/admin manage TPs in their course" on public.tps;

create policy "tps: trainer manages TPs in their course"
on public.tps for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "tps: admin manages TPs in their center"
on public.tps for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ---------- assignments ----------

drop policy if exists "assignments: trainer/admin can read assignments in their course" on public.assignments;
drop policy if exists "assignments: trainer/admin manage assignments in their course" on public.assignments;

create policy "assignments: trainer manages assignments in their course"
on public.assignments for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "assignments: admin manages assignments in their center"
on public.assignments for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ---------- celta5_matrix ----------

drop policy if exists "celta5: trainer/admin manage matrix in their course" on public.celta5_matrix;

create policy "celta5: trainer manages matrix in their course"
on public.celta5_matrix for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "celta5: admin manages matrix in their center"
on public.celta5_matrix for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

-- ---------- attendance ----------

drop policy if exists "attendance: trainer/admin manage attendance in their course" on public.attendance;

create policy "attendance: trainer manages attendance in their course"
on public.attendance for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "attendance: admin manages attendance in their center"
on public.attendance for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);
