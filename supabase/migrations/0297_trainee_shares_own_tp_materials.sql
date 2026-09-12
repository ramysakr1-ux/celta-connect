-- A candidate shares their own handouts with the students they are teaching.
--
-- Ramy, 12 Sep 2026: "nothing happens when I click on share with students."
-- The button and the server action were both fixed to accept a candidate, but
-- volunteer_shared_materials had exactly one policy -- trainer/admin manage
-- their course -- so a candidate's insert matched nothing and RLS refused it
-- without a word. Silently, because the action never read the error back.
--
-- Scope: a candidate may share, and unshare, ONLY material attached to a plan
-- that is theirs. Tutors keep the broader reach they already had (anyone's
-- material on a course at a centre they hold), which is what sharing a
-- demonstration lesson needs.
-- Re-runnable.
drop policy if exists "volunteer_shared_materials: trainee shares their own" on public.volunteer_shared_materials;

create policy "volunteer_shared_materials: trainee shares their own"
on public.volunteer_shared_materials for all
to authenticated
using (
  tp_material_id in (
    select m.id
    from public.tp_materials m
    join public.tp_plans p on p.id = m.tp_plan_id
    where p.trainee_id = (select auth.uid())
      and p.course_id = volunteer_shared_materials.course_id
  )
)
with check (
  tp_material_id in (
    select m.id
    from public.tp_materials m
    join public.tp_plans p on p.id = m.tp_plan_id
    where p.trainee_id = (select auth.uid())
      and p.course_id = volunteer_shared_materials.course_id
  )
);
