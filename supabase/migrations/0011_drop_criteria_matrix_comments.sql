-- Removes the per-criterion tutor comment fields on celta5_matrix.
-- The real CELTA5 Candidate Record Booklet only has a single S+/S/N/X
-- rating per criterion (see the actual Stage Two/Three Progress Record
-- tables) -- there is no per-criterion comment field, only stage-level
-- free-text boxes ("Summary of tutorial and action points", already
-- covered by stage2_tutor_notes/stage3_tutor_notes on celta5_records).
-- Keeping a comment box under every one of the 27 criteria rows was an
-- app-only addition beyond what the booklet actually asks for.

alter table public.celta5_matrix drop column tutor_comments_stage2;
alter table public.celta5_matrix drop column tutor_comments_stage3;

drop function if exists public.get_my_celta5_matrix();

create function public.get_my_celta5_matrix()
returns table (
  id uuid,
  course_id uuid,
  trainee_id uuid,
  criteria_code text,
  candidate_status public.criteria_rating,
  tutor_status_stage2 public.criteria_rating,
  tutor_status_stage3 public.criteria_rating,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id, m.course_id, m.trainee_id, m.criteria_code,
    m.candidate_status,
    case when r.stage2_completed_at is not null then m.tutor_status_stage2 end,
    case when r.trainer_signoff_final_at is not null then m.tutor_status_stage3 end,
    m.updated_at
  from public.celta5_matrix m
  join public.celta5_records r on r.trainee_id = m.trainee_id
  where m.trainee_id = auth.uid();
$$;
