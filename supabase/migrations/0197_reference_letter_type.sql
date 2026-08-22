-- for-claude-code-reference-letter.md: reuses formal_letters (migration
-- 0138) rather than a new table -- same shape (drafted from real data,
-- edited by a person, frozen into a stored snapshot at issue time, PDF
-- rendered from that snapshot, existing /api/formal-letter/[letterId]
-- route already serves any letter_type generically). Adds 'reference' as a
-- fourth letter_type; no other schema change needed. related_assignment_id
-- and related_deferral_transfer_id stay null for this type.
alter table public.formal_letters drop constraint formal_letters_letter_type_check;
alter table public.formal_letters
  add constraint formal_letters_letter_type_check
  check (letter_type in ('fail_risk', 'assignment_warning', 'deferral', 'reference'));
