-- Centre Admin.dc.html 2a: delivery mode is asked once at course setup and
-- read by the timetable, observation log, and pre-course task rules going
-- forward. Handbook 2.2.1 defines it by where TEACHING PRACTICE happens,
-- not input -- a course can teach input online and still be "face-to-face."
-- Default 'f2f' backfills every existing course safely, matching that
-- definition for courses that have never had a mode question asked.
--
-- This migration only captures the field. Downstream enforcement (timetable
-- one-mode-per-TP-block validation, the online-course required extras, the
-- mixed-mode 2hr-minimum-per-mode hours split, the observation log's mode
-- column) is real future work, not built here -- see build-spec item 19.

alter table public.courses
  add column delivery_mode text not null default 'f2f'
    check (delivery_mode in ('f2f', 'online', 'mixed'));
