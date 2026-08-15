-- for-claude-code-announcements-list.md: the third scope alongside the
-- tp_group/subgroup pair from migration 0094 -- a personal, one-candidate
-- announcement ("Assignment 4 feedback is ready"). At most one of the
-- three scope columns is ever set; all three null = course-wide (existing
-- behaviour, unchanged).
alter table public.course_broadcasts
  add column visible_to_trainee_id uuid references public.profiles(id) on delete cascade,
  add constraint course_broadcasts_one_scope check (
    (case when visible_to_tp_group_id is not null then 1 else 0 end)
    + (case when visible_to_subgroup_id is not null then 1 else 0 end)
    + (case when visible_to_trainee_id is not null then 1 else 0 end)
    <= 1
  );

-- source_key: idempotency marker for the auto-generated Table-A/B
-- announcements (day-before-deadline, TP-round-released, etc.) -- lets
-- generateStandardAnnouncements() and the rotation/assignment hooks run
-- repeatedly (timetable re-locked, round re-released) without ever
-- inserting the same announcement twice. Null for every hand-written
-- announcement, which never needs this.
alter table public.course_broadcasts add column source_key text;

create unique index course_broadcasts_course_source_key_idx
  on public.course_broadcasts (course_id, source_key)
  where source_key is not null;

drop policy "course_broadcasts: cohort reads their course's broadcasts" on public.course_broadcasts;

create policy "course_broadcasts: cohort reads their course's broadcasts"
on public.course_broadcasts for select
to authenticated
using (
  course_id = public.current_course_id()
  and (
    (visible_to_tp_group_id is null and visible_to_subgroup_id is null and visible_to_trainee_id is null)
    or (visible_to_subgroup_id is not null and exists (
      select 1 from public.course_subgroup_members m
      where m.subgroup_id = course_broadcasts.visible_to_subgroup_id and m.trainee_id = auth.uid()
    ))
    or (visible_to_tp_group_id is not null and exists (
      select 1 from public.course_subgroup_members m
      join public.course_subgroups g on g.id = m.subgroup_id
      where g.tp_group_id = course_broadcasts.visible_to_tp_group_id and m.trainee_id = auth.uid()
    ))
    or (visible_to_trainee_id is not null and visible_to_trainee_id = auth.uid())
  )
);
