-- CELTA Administration Handbook June 2025 s7.9 (real PDF read directly
-- 2026-08-27, not the audit's paraphrase): deferral dropped the 2022
-- edition's numeric ">50% completed" threshold entirely -- "A deferral may
-- be considered if a candidate has completed part of the course" -- and
-- added a genuinely new required step instead: "Where centres are mindful
-- to agree to a deferral, they must consult Cambridge English through the
-- process described below." Nothing in deferral_transfers (0071) tracks
-- that consultation ever happened. Same agreed_at-timestamp shape as the
-- existing mode_change_agreed_at column on this same table.
alter table public.deferral_transfers
  add column if not exists cambridge_consulted_at timestamptz;
