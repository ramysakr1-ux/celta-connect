-- SS9.5 end-of-course final report. The real center report format (Ramy's
-- existing Word-doc reports, confirmed against actual filled examples) has
-- a two-row breakdown feeding the overall grade -- "Preparing, planning and
-- practising teaching" and "Written assignments" -- that nothing in the
-- schema captured as a distinct value before now (final_recommended_grade
-- was always just the single overall figure). Same four-tier scale as the
-- final grade itself.

alter table public.celta5_records add column final_teaching_grade text check (
  final_teaching_grade in ('Pass', 'Pass B', 'Pass A', 'Fail')
);

alter table public.celta5_records add column final_assignments_grade text check (
  final_assignments_grade in ('Pass', 'Fail')
);
