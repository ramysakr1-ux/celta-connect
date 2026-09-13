-- The criteria auto-tagger's glossary, editable by the centre.
--
-- Ramy, 13 Sep 2026: "put the glossary behind a Centre Management screen and
-- MCT as well."
--
-- Until now the glossary lived only in src/lib/criteria-glossary.ts -- 64
-- terms of trainer shorthand mapped to CELTA 5 codes, matched as the tutor
-- types a feedback point. Its own comment always said it was "meant to grow
-- from real trainer phrasing over time"; this is where it grows.
--
-- The built-in table stays as the starting point for every centre. A row here
-- either ADDS a term of the centre's own, or SHADOWS a built-in: same term,
-- `enabled = false`, and the built-in stops firing for that centre.
--
-- Re-runnable.

create table if not exists public.center_criteria_terms (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  -- Matched case-insensitively as a whole word or phrase, so it is stored
  -- lower-case and trimmed by the server action that writes it.
  term text not null,
  criteria_codes text[] not null default '{}',
  -- false = this term does not fire at this centre. On a term that also
  -- exists in the built-in glossary, that is how a centre turns one off.
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, term)
);

create index if not exists center_criteria_terms_center_idx
  on public.center_criteria_terms (center_id);

-- Two people can edit this: a Centre manager and any MCT at the centre.
-- Ramy's standing rule -- wherever more than one person can act on a
-- management area, log actor + before/after + when.
create table if not exists public.center_criteria_term_changes (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  term text not null,
  action text not null check (action in ('added', 'edited', 'removed', 'disabled', 'enabled')),
  codes_before text[],
  codes_after text[],
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists center_criteria_term_changes_center_idx
  on public.center_criteria_term_changes (center_id, changed_at desc);

alter table public.center_criteria_terms enable row level security;
alter table public.center_criteria_term_changes enable row level security;

-- READ is wide on purpose: every tutor's feedback form has to resolve the
-- glossary to tag anything, so anyone attached to the centre can read it.
-- There is deliberately NO insert/update/delete policy. Writes go through the
-- server actions, which check the capability (centre.settings.edit) or MCT
-- standing first and then use the service role -- the same shape the centre
-- settings screen already uses.
drop policy if exists "center_criteria_terms: centre members read" on public.center_criteria_terms;
create policy "center_criteria_terms: centre members read"
on public.center_criteria_terms for select
to authenticated
using (
  center_id in (
    select p.center_id from public.profiles p where p.id = (select auth.uid())
    union
    select r.center_id from public.centre_roles r
      where r.profile_id = (select auth.uid()) and r.revoked_at is null
  )
);

drop policy if exists "center_criteria_term_changes: centre members read" on public.center_criteria_term_changes;
create policy "center_criteria_term_changes: centre members read"
on public.center_criteria_term_changes for select
to authenticated
using (
  center_id in (
    select p.center_id from public.profiles p where p.id = (select auth.uid())
    union
    select r.center_id from public.centre_roles r
      where r.profile_id = (select auth.uid()) and r.revoked_at is null
  )
);
