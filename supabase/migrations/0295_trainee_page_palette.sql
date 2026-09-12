-- Personalised trainee pages, the small kind. Ramy, 12 Sep 2026: "can we do
-- the same thing for the trainees, for the landing page and the different
-- pages?" -- yes, as paper: five curated palettes that change the page
-- ground, the frame and the cards only. Teal, garnet, gold, the status
-- pills, the avatar colour and the timetable's category tints keep their
-- meaning. One column on the trainee's own settings row. Re-runnable.
alter table public.trainee_notebook_settings
  add column if not exists page_palette text not null default 'linen'
  check (page_palette in ('linen', 'sky', 'sage', 'rose', 'lavender'));
