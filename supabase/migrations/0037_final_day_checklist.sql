-- Final-day tick-box + sign-off page, real verbatim wording transcribed
-- from the CELTA5 booklet (see project_content_architecture_spec memory,
-- 2026-08-04). Each of the 5 confirmations gets its own column so a future
-- Drive-export migration has real per-item data to carry over onto the
-- authoritative document, not just one lump timestamp. This replaces the
-- old generic "I've reviewed my final record and sign off" button, it
-- doesn't sit alongside it -- trainee_sign_off_final() now requires all
-- five to be true before it will set trainee_signoff_final_at at all.
--
-- grade_review_tutor_comments is the second box ("INFORMATION FOR THE
-- CELTA GRADE REVIEW..."), trainer-authored, only relevant/shown when
-- stage3_required is true, and (like final_recommended_grade/overall_notes
-- per migration 0034) never revealed to the trainee -- it's Cambridge/
-- assessor-facing commentary, not trainee-facing feedback.
alter table public.celta5_records
  add column final_checklist_tp boolean not null default false,
  add column final_checklist_observations boolean not null default false,
  add column final_checklist_assignments boolean not null default false,
  add column final_checklist_own_work boolean not null default false,
  add column final_checklist_all_records boolean not null default false,
  add column grade_review_tutor_comments text;

drop function if exists public.trainee_sign_off_final();

create function public.trainee_sign_off_final(
  p_checklist_tp boolean,
  p_checklist_observations boolean,
  p_checklist_assignments boolean,
  p_checklist_own_work boolean,
  p_checklist_all_records boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    p_checklist_tp and p_checklist_observations and p_checklist_assignments
    and p_checklist_own_work and p_checklist_all_records
  ) then
    raise exception 'All five confirmations must be checked before signing off.';
  end if;

  update public.celta5_records
  set trainee_signoff_final_at = now(),
      final_checklist_tp = p_checklist_tp,
      final_checklist_observations = p_checklist_observations,
      final_checklist_assignments = p_checklist_assignments,
      final_checklist_own_work = p_checklist_own_work,
      final_checklist_all_records = p_checklist_all_records
  where trainee_id = auth.uid()
    and trainer_signoff_final_at is not null
    and trainee_signoff_final_at is null;
end;
$$;

grant execute on function public.trainee_sign_off_final(boolean, boolean, boolean, boolean, boolean) to authenticated;
