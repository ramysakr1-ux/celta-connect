-- Per-center example snippets used to few-shot prime the AI tone-cleanup
-- feature (see src/app/dashboard/trainer/tone-cleanup-actions.ts). Added
-- once by a trainer/admin, edited as needed, automatically included on
-- every cleanup call for that center -- never re-entered per use.

create table public.feedback_style_examples (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  tone text not null check (tone in ('direct', 'supportive')),
  example_text text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index feedback_style_examples_center_id_idx on public.feedback_style_examples (center_id);

alter table public.feedback_style_examples enable row level security;

create policy "feedback_style_examples: trainer/admin manage their center's style examples"
on public.feedback_style_examples for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and center_id = public.current_center_id())
with check ((public.is_trainer() or public.is_admin()) and center_id = public.current_center_id());
