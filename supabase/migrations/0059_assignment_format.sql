-- remaining-compliance.md item 1: "Syllabus, assessment requirements --
-- two of the assignments must be written in academic prose." Records which
-- two of a centre's four briefs are continuous prose vs structured
-- (sections/tables) so the count can be validated on publish, matching the
-- shipped default: Focus on Learner + LfC are prose, LRT + Skills are
-- structured.

alter table public.assignment_templates
  add column format text not null default 'structured' check (format in ('prose', 'structured'));

update public.assignment_templates
set format = 'prose'
where assignment_type in ('Focus on Learner', 'LfC');
