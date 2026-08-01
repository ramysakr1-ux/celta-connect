-- One row per trainee/course holding the CELTA 5 record's final,
-- course-level fields -- distinct from celta5_matrix, which holds one row
-- per individual criterion.

create table public.celta5_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  trainee_id uuid not null references public.profiles (id) on delete cascade,
  final_recommended_grade text check (
    final_recommended_grade in ('Pass', 'Pass B', 'Pass A', 'Fail')
  ),
  overall_notes text,
  updated_at timestamptz not null default now(),
  unique (trainee_id)
);

create index celta5_records_course_id_idx on public.celta5_records (course_id);

alter table public.celta5_records enable row level security;

create policy "celta5_records: trainee can read their own record"
on public.celta5_records for select
to authenticated
using (trainee_id = auth.uid());

create policy "celta5_records: trainer manages records in their course"
on public.celta5_records for all
to authenticated
using (public.is_trainer() and course_id = public.current_course_id())
with check (public.is_trainer() and course_id = public.current_course_id());

create policy "celta5_records: admin manages records in their center"
on public.celta5_records for all
to authenticated
using (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
)
with check (
  public.is_admin()
  and course_id in (select id from public.courses where center_id = public.current_center_id())
);

create trigger set_updated_at before update on public.celta5_records
for each row execute function public.set_updated_at();
