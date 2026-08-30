-- Two things the Grades Report needs that the record has nowhere to keep.
--
-- 1. The tutor's curation of the four criteria lists.
--
-- The lists are derived from the CELTA 5 matrix -- S+ becomes a strength, N
-- becomes an action point, section 4 is planning and the rest teaching. That
-- is right, and Ramy confirmed it: "the strengths and action points would be
-- the S pluses and the N's."
--
-- But he also said "or the weak S's", and there is no weak-S rating: the
-- matrix has S+, S, N, X and nothing between. A borderline S that a tutor
-- wants to raise as an action point is a judgement no derivation can make,
-- so the tutor has to be able to add a criterion to a list -- and to drop a
-- derived one that does not belong in this report.
--
-- Stored as codes, never as text, so the wording stays Cambridge's own
-- (CRITERIA_LABELS) wherever it is rendered. Ramy: "the criteria has to be
-- word for word Cambridge criteria, not a paraphrase of it."
--
-- Shape:
--   {"planningStrengths": {"add": ["4c"], "remove": ["4a"]}, ...}
--
-- Removals are remembered against the code, so a tutor who drops a line and
-- later changes that criterion's matrix rating does NOT get it back. Taking a
-- line out is a judgement about this report; silently reinstating it would
-- undo the tutor's work without telling them.

alter table public.celta5_records
  add column if not exists grades_report_list_overrides jsonb not null default '{}'::jsonb;

comment on column public.celta5_records.grades_report_list_overrides is
  'Per-list {add:[code], remove:[code]} curation of the four derived Grades Report lists. Codes only -- the wording always comes from CRITERIA_LABELS so it stays Cambridge verbatim. A removal survives a later matrix change on purpose.';

-- 2. Appian's second higher-grade field.
--
-- The real report (C14_GREEN - Final Grades.docx) carries both:
--
--   EVIDENCE NEEDED FOR A HIGHER GRADE (IF APPLICABLE)
--   WHAT EVIDENCE WAS PROVIDED FOR A HIGHER GRADE (IF APPLICABLE)
--
-- The first is what a slashed candidate must do, written at the provisional
-- stage -- that is provisional_upgrade_conditions, which already exists. The
-- second is the answer to it at the final stage, and had nowhere to live.
-- The Administration Handbook names it too, in the assessor report's own
-- field list.

alter table public.celta5_records
  add column if not exists final_higher_grade_evidence text;

comment on column public.celta5_records.final_higher_grade_evidence is
  'Appian "What evidence was provided for a higher grade (if applicable)" -- the final-stage answer to provisional_upgrade_conditions. Written when the slash resolves.';
