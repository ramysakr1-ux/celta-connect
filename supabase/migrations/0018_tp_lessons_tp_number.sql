-- Reintroduces a link from the open, unnumbered tp_lessons log (migration
-- 0006) to a specific TP round, but only for TP1-6 (library-driven) --
-- nullable, so lessons outside the rotation (or future TP7/8) stay
-- unnumbered exactly as today. This is what lets the trainee's unified TP
-- box show assigned content (plan_assignments) and outcome (tp_lessons)
-- together, and lets logging the outcome double as the taught-gate trigger
-- (createTpLesson/updateTpLesson) instead of a separate "Mark taught" click.

alter table public.tp_lessons add column tp_number smallint check (tp_number between 1 and 6);

-- At most one outcome record per trainee per TP round.
create unique index tp_lessons_trainee_tp_number_uidx
  on public.tp_lessons (trainee_id, tp_number)
  where tp_number is not null;
