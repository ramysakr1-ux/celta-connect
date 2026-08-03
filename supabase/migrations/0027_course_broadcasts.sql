-- §4 Course Stream -- trainer-authored announcements, newest first, pinned
-- ones on top. Attachments kept to a single optional link for this first
-- pass (not a repeatable multi-attachment list yet) -- expandable later
-- without a schema change since it's its own nullable pair of columns.

create table public.course_broadcasts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  pinned boolean not null default false,
  zoom_url text,
  zoom_time timestamptz,
  attachment_name text,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index course_broadcasts_course_id_idx on public.course_broadcasts (course_id);

alter table public.course_broadcasts enable row level security;

create policy "course_broadcasts: cohort reads their course's broadcasts"
on public.course_broadcasts for select
to authenticated
using (course_id = public.current_course_id());

create policy "course_broadcasts: admin reads broadcasts in their center"
on public.course_broadcasts for select
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create policy "course_broadcasts: trainer manages their course's broadcasts"
on public.course_broadcasts for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id() and author_id = auth.uid());

create policy "course_broadcasts: admin manages broadcasts in their center"
on public.course_broadcasts for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
  and author_id = auth.uid()
);
