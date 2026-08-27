-- Admin Handbook June 2025 s7.5: "Candidates who know in advance that they
-- cannot attend/participate in significant parts of the course must not be
-- accepted." The existing cannot_attend_note (0081) collects the detail,
-- optionally -- nothing required the applicant to actually confirm they
-- have no such conflict. Same acknowledged_*_at shape as the other
-- application-time acks on this table.
alter table public.applicants
  add column if not exists acknowledged_full_attendance_at timestamptz;
