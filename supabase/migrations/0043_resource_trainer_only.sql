-- Resource Hub shell gap found live 2026-08-05: every resource was visible
-- to whoever could reach the page at all -- trainer and trainee saw an
-- identical list. Ramy: "some will only be visible to the trainers, like
-- the original CELTA 5 [template] also will live in there." Default true
-- (most resources -- templates, forms, briefs -- are meant for trainees;
-- trainer opts a specific item OUT, e.g. an internal CELTA5 blank template
-- or an assessor-facing document) rather than default false, which would
-- silently hide everything already uploaded under the old assumption.
alter table public.resources add column visible_to_trainee boolean not null default true;
