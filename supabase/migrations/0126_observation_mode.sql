-- Mixed-mode delivery, piece 2 of 3 (delivery-mode.ts's own "not yet built"
-- list): "Experienced-teacher observation must cover both modes, so the
-- observation log gains a mode field." Nullable and only shown/asked on
-- mixed-mode courses -- f2f/online-only courses have exactly one mode
-- already, asking would be noise.

alter table public.observations add column if not exists mode text check (mode in ('f2f', 'online'));

comment on column public.observations.mode is
  'Which mode this observation was of. Only meaningful (and only asked) on a mixed-mode course; null on f2f/online-only courses.';
