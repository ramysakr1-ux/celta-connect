-- connect-build-specs-5-gaps-2026-08-21.md item 4: "sign once, reuse
-- everywhere" -- confirmed with Ramy this is for every role on the course
-- (trainee, trainer, admin), not trainee-only, so it lives on profiles
-- rather than a trainee-scoped table. This migration builds the
-- reusable field + RPC, and wires it into the two concrete candidate-side
-- gaps this session found: Stage 1 and Stage 3 had NO candidate signature
-- column at all (confirmed against every stageN_* column in
-- 0006_celta5_full_rebuild.sql -- both were tutor-only). Stage 2's
-- existing sign-off (0009_celta5_visibility_rework.sql) is upgraded to
-- the same shape for consistency, rather than leaving it the one stage
-- with a bare timestamp and no captured name.
--
-- Fixed for the course once set (raises on a second attempt), per the
-- spec's own "typed once at enrolment and fixed for the course" -- this
-- is deliberately not editable self-service; a genuine correction is an
-- admin's job, not built here since nothing in this pass asked for it.
--
-- Each per-document signature copies the name into its OWN column at
-- signing time (stage1_candidate_signature_name etc.), not just a
-- foreign-key style reference to profiles.signature_name -- same
-- reasoning as the existing ai_disclaimer_signed_name precedent
-- (migration 0142): if profiles.signature_name were ever corrected later,
-- a filed record must keep showing exactly what was actually signed.

alter table public.profiles
  add column signature_name text,
  add column signature_set_at timestamptz;

comment on column public.profiles.signature_name is
  'Typed once, fixed for the course -- every signature after this reuses it. Any role: trainee, trainer, admin.';

create or replace function public.set_my_signature(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
begin
  select signature_name into v_existing from public.profiles where id = auth.uid();
  if v_existing is not null then
    raise exception 'Your signature is already set -- it''s fixed for the course.';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Type your name first.';
  end if;

  update public.profiles
  set signature_name = btrim(p_name), signature_set_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.set_my_signature(text) to authenticated;

-- ============================================================
-- Stage 1 candidate signature -- genuinely new, no prior column existed.
-- ============================================================

alter table public.celta5_records
  add column stage1_candidate_signature_name text,
  add column stage1_candidate_signed_at timestamptz;

create or replace function public.trainee_sign_off_stage1()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signature text;
begin
  select signature_name into v_signature from public.profiles where id = auth.uid();
  if v_signature is null then
    raise exception 'Set your signature first.';
  end if;

  update public.celta5_records
  set stage1_candidate_signature_name = v_signature,
      stage1_candidate_signed_at = now()
  where trainee_id = auth.uid()
    and stage1_tutorial_given is true
    and stage1_candidate_signed_at is null;
end;
$$;

grant execute on function public.trainee_sign_off_stage1() to authenticated;

-- ============================================================
-- Stage 3 candidate signature -- same gap, same fix.
-- ============================================================

alter table public.celta5_records
  add column stage3_candidate_signature_name text,
  add column stage3_candidate_signed_at timestamptz;

create or replace function public.trainee_sign_off_stage3()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signature text;
begin
  select signature_name into v_signature from public.profiles where id = auth.uid();
  if v_signature is null then
    raise exception 'Set your signature first.';
  end if;

  update public.celta5_records
  set stage3_candidate_signature_name = v_signature,
      stage3_candidate_signed_at = now()
  where trainee_id = auth.uid()
    and stage3_finalized_at is not null
    and stage3_candidate_signed_at is null;
end;
$$;

grant execute on function public.trainee_sign_off_stage3() to authenticated;

-- ============================================================
-- Stage 2 -- already had a candidate sign-off (trainee_signoff_stage2_at,
-- migration 0009), just as a bare timestamp with no captured name.
-- Brought up to the same reusable-signature shape; the RPC signature
-- itself doesn't change so no call-site changes are needed for this part.
-- ============================================================

alter table public.celta5_records
  add column stage2_candidate_signature_name text;

create or replace function public.trainee_sign_off_stage2()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signature text;
begin
  select signature_name into v_signature from public.profiles where id = auth.uid();
  if v_signature is null then
    raise exception 'Set your signature first.';
  end if;

  update public.celta5_records
  set trainee_signoff_stage2_at = now(),
      stage2_candidate_signature_name = v_signature
  where trainee_id = auth.uid()
    and stage2_completed_at is not null
    and trainee_signoff_stage2_at is null;
end;
$$;

-- ============================================================
-- Final-day declaration -- same signature upgrade, preserving migration
-- 0037's full five-checkbox validation body verbatim.
-- ============================================================

alter table public.celta5_records
  add column final_candidate_signature_name text;

create or replace function public.trainee_sign_off_final(
  p_checklist_tp boolean,
  p_checklist_observations boolean,
  p_checklist_assignments boolean,
  p_checklist_own_work boolean,
  p_checklist_all_records boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signature text;
begin
  if not (
    p_checklist_tp and p_checklist_observations and p_checklist_assignments
    and p_checklist_own_work and p_checklist_all_records
  ) then
    raise exception 'All five confirmations must be checked before signing off.';
  end if;

  select signature_name into v_signature from public.profiles where id = auth.uid();
  if v_signature is null then
    raise exception 'Set your signature first.';
  end if;

  update public.celta5_records
  set trainee_signoff_final_at = now(),
      final_checklist_tp = p_checklist_tp,
      final_checklist_observations = p_checklist_observations,
      final_checklist_assignments = p_checklist_assignments,
      final_checklist_own_work = p_checklist_own_work,
      final_checklist_all_records = p_checklist_all_records,
      final_candidate_signature_name = v_signature
  where trainee_id = auth.uid()
    and trainer_signoff_final_at is not null
    and trainee_signoff_final_at is null;
end;
$$;

-- ============================================================
-- "This declaration is what decides Withdrawn vs. Fail for a candidate
-- who doesn't attend the final day and hasn't signed it" -- a daily
-- sweep, not a live trigger, since it only ever fires once a course's own
-- end_date has actually passed. Deliberately narrow: only touches a
-- trainee who is BOTH unsigned AND has no final_recommended_grade at all
-- -- if a trainer already recorded a real outcome for them (Pass, Fail,
-- whatever), that's the authoritative record and this must never
-- overwrite it. Only genuinely means "nobody ever recorded what happened
-- to this candidate" gets auto-resolved to Withdrawn. Fail itself is
-- never set by this sweep -- Fail already has its own real path (the
-- assignment/TP grading pipeline); this only ever produces Withdrawn,
-- matching "decides Withdrawn... for a candidate who doesn't attend."
create or replace function public.run_final_day_withdrawal_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set course_status = 'withdrawn',
      course_status_set_at = now(),
      course_status_note = 'Auto-withdrawn: the final-day declaration was never signed and no final grade was ever recorded, after the course''s own end date passed.'
  from public.courses c, public.celta5_records r
  where p.course_id = c.id
    and r.trainee_id = p.id
    and p.role = 'trainee'
    and p.course_status = 'active'
    and c.end_date < current_date
    and r.trainee_signoff_final_at is null
    and r.final_recommended_grade is null;
end;
$$;

-- cron.schedule() is idempotent by job name -- re-running this migration
-- (e.g. a re-paste after an earlier error) updates the existing job
-- rather than creating a duplicate.
select cron.schedule(
  'final-day-withdrawal-sweep',
  '0 6 * * *',
  $$select public.run_final_day_withdrawal_sweep();$$
);
