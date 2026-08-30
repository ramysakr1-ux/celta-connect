-- The Appian course notification reference number.
--
-- Handbook 7.6: when CELTA Admin approves a course, "the centre will also
-- receive a notification reference number to be used when submitting forms in
-- Appian for the course that has been approved, i.e. the entry form and
-- centre grade form."
--
-- Handbook 14.1 makes handing it over one of four things the centre must do
-- 2-3 days before the assessment: "confirm arrangements and agree a final
-- timetable with the assessor, complete the centre grade form in Appian,
-- GIVE THE ASSESSOR THE COURSE NOTIFICATION REFERENCE NUMBER, and for
-- face-to-face assessments provide a map and accommodation details."
--
-- And 15.2 is why it matters: "The assessor's report is completed online via
-- Appian and in order to access it for a particular course/centre, assessors
-- need details of the notification reference number, which the centre should
-- supply." Without this string the assessor cannot open their report at all,
-- so a centre that forgets it has blocked the assessment without knowing.
--
-- Connect stored the assessor's name, email, visit date and assessment kind
-- but not this, which meant the one item on 14.1's list that Connect could
-- have carried was the one it did not. Ramy raised it from memory on
-- 30 Aug 2026 and the documents bore him out.
--
-- Free text, not a checked format: Cambridge has never published the shape of
-- the reference, and a centre pasting what CELTA Admin emailed them should
-- never be told it looks wrong by us.

alter table public.courses
  add column if not exists appian_notification_reference text;

comment on column public.courses.appian_notification_reference is
  'Appian course notification reference number, issued to the centre by CELTA Admin on course approval (Handbook 7.6). The centre must give it to the assessor 2-3 days before the assessment (14.1); without it the assessor cannot open their Assessor Report (15.2). Free text -- Cambridge publishes no format.';
