-- §5 Resource Hub -- the `resources` table (migration 0001) only ever had
-- title/file_url; the portfolio Resource Hub groups items by a fixed
-- category taxonomy and shows a type badge/icon per item, so both need to
-- exist as real columns rather than being inferred from the title.

alter table public.resources add column description text;

alter table public.resources add column category text not null default 'lesson_planning' check (
  category in ('lesson_planning', 'teaching_practice', 'written_assignments', 'cambridge_documentation', 'reading_input')
);
alter table public.resources alter column category drop default;

alter table public.resources add column resource_type text not null default 'template' check (
  resource_type in ('template', 'form', 'brief', 'cambridge_doc', 'reading', 'video')
);
alter table public.resources alter column resource_type drop default;
