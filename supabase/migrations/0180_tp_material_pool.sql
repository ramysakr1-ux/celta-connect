-- connect-spec-corrections-for-claude-code.md item 6: TP7/8 material pool
-- -- deliberately-not-the-coursebook scanned material for the final two
-- assessed lessons. "Open for Claude Code to scope"; scoped here as:
--
-- - One table for the pool itself. center_id null = the baseline library
--   (platform-provided, visible to every centre); center_id set = that
--   one centre's own added scan, visible only there. No fabricated
--   content seeded -- real scanned book pages are copyrighted publisher
--   material, not something to invent; the baseline library starts empty,
--   ready for real scans to be uploaded into it later.
-- - Storage reuses the existing resource-hub-files bucket (same as
--   Cambridge documents), under its own tp-material-pool/ prefix.
-- - "Reused across multiple consecutive courses... a standing resource" --
--   items are never deleted when a course ends, only claims are course-
--   scoped, so the same item is available fresh to the next course.
-- - Claim/reservation: first-come, candidate-claimed directly (not
--   tutor-assigned) -- "candidates browse the pool and pick/claim" reads
--   as their own action. Reserved per TP group, not per course: the whole
--   point is nobody else in the SAME group plans around the same
--   material, not that no other group at the centre may ever use it.
create table public.tp_material_pool_items (
  id uuid primary key default gen_random_uuid(),
  center_id uuid references public.centers (id) on delete cascade,
  book_title text not null,
  level text,
  description text,
  storage_path text not null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tp_material_pool_items_center_id_idx on public.tp_material_pool_items (center_id);

alter table public.tp_material_pool_items enable row level security;

-- Baseline (center_id null) readable by everyone; a centre's own addition
-- only by that centre. No insert/update/delete policy -- writes go
-- through the admin client after an app-layer role check, same pattern
-- as cambridge_documents.
create policy "tp_material_pool_items: baseline or own centre readable"
on public.tp_material_pool_items for select
to authenticated
using (center_id is null or center_id = public.current_center_id());

create table public.tp_material_pool_claims (
  id uuid primary key default gen_random_uuid(),
  material_item_id uuid not null references public.tp_material_pool_items (id) on delete cascade,
  tp_group_id uuid not null references public.course_tp_groups (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  tp_number smallint not null check (tp_number in (7, 8)),
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  -- The reservation itself: once claimed by anyone in a TP group, nobody
  -- else in that same group can also claim it (for either TP number --
  -- one book, one planning context).
  unique (material_item_id, tp_group_id),
  -- One material per trainee per TP number per course -- can't claim two
  -- things for the same lesson; a deferred/restarted trainee on a new
  -- course_id claims fresh.
  unique (trainee_id, course_id, tp_number)
);
create index tp_material_pool_claims_tp_group_id_idx on public.tp_material_pool_claims (tp_group_id);
create index tp_material_pool_claims_trainee_id_idx on public.tp_material_pool_claims (trainee_id);

alter table public.tp_material_pool_claims enable row level security;

create policy "tp_material_pool_claims: cohort reads their course's claims"
on public.tp_material_pool_claims for select
to authenticated
using (course_id = public.current_course_id());

-- Atomic claim-on-click via the unique index above, same race-guard shape
-- as the existing staff/interview-slot booking actions -- a trainee can
-- also release their own claim (delete), first-come cutting both ways.
create policy "tp_material_pool_claims: trainee manages their own claim"
on public.tp_material_pool_claims for all
to authenticated
using (trainee_id = auth.uid() and course_id = public.current_course_id())
with check (trainee_id = auth.uid() and course_id = public.current_course_id());

create policy "tp_material_pool_claims: trainer/admin manage their course's claims"
on public.tp_material_pool_claims for all
to authenticated
using ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id())
with check ((public.is_trainer() or public.is_admin()) and course_id = public.current_course_id());
