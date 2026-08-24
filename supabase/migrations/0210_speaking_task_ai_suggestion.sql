-- Ramy, 24 Aug 2026: "now please" -- wires the speaking-task transcript
-- (migration 0209) into an AI suggestion, same pattern as
-- task_feedback_ai_suggestion for the writing task. Deliberately its own
-- column, not folded into ai_reading_summary/ai_reading_lane -- that
-- 5-row scheme (language_awareness/accuracy/organisation/range/substance)
-- drives real auto-booking and clear-problems-notification behavior per
-- Admin Handbook 6.3, and the speaking task was never part of that scheme.
-- This is purely an additional, read-only suggestion next to the
-- recording -- it does not touch deriveTriageLane or anything it decides.
alter table public.applicants
  add column speaking_task_ai_suggestion text,
  add column speaking_task_ai_suggestion_generated_at timestamptz;
