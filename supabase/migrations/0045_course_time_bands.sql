-- Per-course editable daily time-band structure for the timetable grid.
-- Null means "use the standard default shape" (DEFAULT_TIME_BANDS in
-- src/lib/timetable-grid.ts) -- most courses never need to touch this, only
-- ones with a genuinely different daily rhythm (afternoon-only, online,
-- full-time) as confirmed against three real historical timetable exports.
alter table public.courses
  add column time_bands jsonb null;

comment on column public.courses.time_bands is
  'Array of {start, end, label} time bands for the timetable grid columns, e.g. [{"start":"10:00","end":"12:30","label":"10:00-12:30"}]. Null = use the standard default shape.';
