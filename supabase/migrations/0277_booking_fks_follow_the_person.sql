-- Found 5 Sep 2026 by the demo seed's own teardown: once a candidate had
-- actually BOOKED a Stage 2 position (which no demo data did until today),
-- their account could no longer be hard-deleted -- stage2_tutorial_slots.
-- trainee_id (0094) and my consultation_slots.trainee_id / both tables'
-- created_by (0275) reference profiles with NO delete rule, so the
-- auth-user cascade hits NO ACTION and the delete 500s.
--
-- A booking follows the person: delete the person and the position goes
-- back to open (SET NULL), it doesn't wall them in. created_by is
-- provenance, not ownership -- SET NULL there too.

alter table public.stage2_tutorial_slots
  drop constraint stage2_tutorial_slots_trainee_id_fkey,
  add constraint stage2_tutorial_slots_trainee_id_fkey
    foreign key (trainee_id) references public.profiles(id) on delete set null;

alter table public.stage2_tutorial_blocks
  drop constraint stage2_tutorial_blocks_created_by_fkey,
  add constraint stage2_tutorial_blocks_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.consultation_slots
  drop constraint consultation_slots_trainee_id_fkey,
  add constraint consultation_slots_trainee_id_fkey
    foreign key (trainee_id) references public.profiles(id) on delete set null;

alter table public.consultation_blocks
  drop constraint consultation_blocks_created_by_fkey,
  add constraint consultation_blocks_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;
