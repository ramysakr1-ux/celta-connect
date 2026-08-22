-- for-claude-code-marketing-source-question.md: "How did you hear about
-- [centre name]?" on the public application form, single-select from a
-- short fixed list plus a free-text "Other". Centre's own marketing signal
-- only -- not shown to trainers/trainees, not part of the academic record,
-- explicitly excluded from the close-out export (course-close-out/export.ts
-- never reads this column, deliberately -- leave it that way).
alter table public.applicants
  add column marketing_source text check (
    marketing_source in ('search_engine', 'social_media', 'friend_recommendation', 'past_graduate', 'other')
  ),
  add column marketing_source_other text;
