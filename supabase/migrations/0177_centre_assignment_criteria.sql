-- build-spec.md: assignment criteria are "centre settings imported at
-- setup, with defaults supplied" -- confirmed with Ramy: this is the
-- "centre judgment" category (as opposed to the fixed assignment
-- instructions/word counts, which stay as they are), the grey area where
-- different centres and tutors reasonably differ. src/lib/assignment-
-- criteria.ts's own hardcoded ASSIGNMENT_CRITERIA becomes the seeded
-- default here, not the source of truth going forward.
--
-- `key` stays stable per row (assignments.first_criteria_marks /
-- resubmission_criteria_marks are keyed by it) -- a centre "removing" a
-- criterion deactivates it rather than deleting the row, so a trainee's
-- already-recorded marks never point at nothing.
create table public.centre_assignment_criteria (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers (id) on delete cascade,
  assignment_type text not null check (
    assignment_type in ('Focus on Learner', 'LRT', 'Skills', 'LfC', 'Plagiarism Reflection')
  ),
  key text not null,
  criterion_text text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (center_id, assignment_type, key)
);

create index centre_assignment_criteria_center_id_idx on public.centre_assignment_criteria (center_id);

alter table public.centre_assignment_criteria enable row level security;

-- Reference content, not sensitive -- previously a code constant everyone
-- could read regardless of centre. Same broad-read shape here, just
-- scoped to the viewer's own centre now that it can actually diverge.
create policy "centre_assignment_criteria: cohort reads their centre's criteria"
on public.centre_assignment_criteria for select
to authenticated
using (center_id = public.current_center_id());

create policy "centre_assignment_criteria: admin manages their centre's criteria"
on public.centre_assignment_criteria for all
to authenticated
using (public.is_admin() and center_id = public.current_center_id())
with check (public.is_admin() and center_id = public.current_center_id());

insert into public.centre_assignment_criteria (center_id, assignment_type, key, criterion_text, sort_order)
select c.id, q.assignment_type, q.key, q.criterion_text, q.sort_order
from public.centers c
cross join (
  values
    ('Focus on Learner', 'learner_background', 'Showing awareness of how a learner''s background, previous learning experience and learning preferences affect learning.', 0),
    ('Focus on Learner', 'language_needs', 'Identifying the learner''s language/skills needs', 1),
    ('Focus on Learner', 'terminology', 'Correctly using terminology relating to the description of language systems and language skills.', 2),
    ('Focus on Learner', 'materials', 'Selecting appropriate material and/or resources (at least one of which must be from published materials) to aid the learners'' language development.', 3),
    ('Focus on Learner', 'rationale', 'Providing a rationale for using specific activities with the learners in mind.', 4),
    ('Focus on Learner', 'referencing', 'Finding, selecting and referencing information from one or more sources, within the body of the assignment.', 5),
    ('Focus on Learner', 'written_language', 'Using written language that is clear, accurate and appropriate to the task', 6),
    ('Focus on Learner', 'word_count', 'The assignment meets the 750-1,000-word count requirement', 7),

    ('LRT', 'analysis', 'Analyses language correctly', 0),
    ('LRT', 'terminology', 'Uses terminology correctly', 1),
    ('LRT', 'reference_materials', 'Shows evidence of having accessed appropriate reference materials, i.e. give the name of at least one book that you have used to research the area', 2),
    ('LRT', 'written_language', 'Uses clear, accurate and appropriate language', 3),
    ('LRT', 'word_count', 'The assignment meets the 750-1,000-word count requirement', 4),

    ('Skills', 'skills_identification', 'Identifying receptive/productive skills that could be practised in relation to the text', 0),
    ('Skills', 'terminology', 'Correctly using terminology that relates to language skills and sub-skills', 1),
    ('Skills', 'task_design', 'Designing tasks in relation to the text with a rationale', 2),
    ('Skills', 'background_reading', 'Finding, selecting and showing evidence of background reading in the topic area i.e. at least one sourced quote in the body of the assignment.', 3),
    ('Skills', 'written_language', 'Using written language that is clear, accurate and appropriate to the task', 4),
    ('Skills', 'word_count', 'The assignment meets the 750-1,000-word count requirement', 5),

    ('LfC', 'strengths_weaknesses', 'Show (convincing) evidence of an ability to identify their own teaching strengths and weaknesses in the light of feedback from learners, teachers and tutors.', 0),
    ('LfC', 'impact_on_learners', 'Show convincing understanding of how their strengths/weaknesses can affect the learners.', 1),
    ('LfC', 'improvement_ideas', 'Identify ways of improving their weaknesses (one or two practical solutions).', 2),
    ('LfC', 'observation_reflection', 'Show reflection on their observation of other teachers in relation to their weaknesses.', 3),
    ('LfC', 'post_celta_development', 'Describe in a specific way how to develop ELT knowledge and skills beyond the course (professional development post-CELTA).', 4),
    ('LfC', 'written_language', 'Able to write in clear, accurate and appropriate language.', 5),
    ('LfC', 'word_count', 'The assignment meets the 750-1,000-word count requirement and there is clear reference to the sources used.', 6),

    ('Plagiarism Reflection', 'own_account', 'Gives their own honest account of what happened and how it came about -- not an apology, an account.', 0),
    ('Plagiarism Reflection', 'rule_identified', 'Quotes the specific centre policy and Cambridge guidance clause breached, and explains why it applies here.', 1),
    ('Plagiarism Reflection', 'professional_impact', 'Explains what it would mean for a learner, a colleague, or the centre if a teacher''s materials or claims were not their own.', 2),
    ('Plagiarism Reflection', 'future_practice', 'Describes specific, concrete changes to how they will work -- source-noting, AI use and declaration -- going forward.', 3),
    ('Plagiarism Reflection', 'word_count', 'The assignment meets the 750-1,000-word count requirement.', 4)
) as q(assignment_type, key, criterion_text, sort_order)
where not exists (
  select 1 from public.centre_assignment_criteria existing where existing.center_id = c.id
);
