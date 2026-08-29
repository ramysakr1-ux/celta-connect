-- stage3_required gated the wrong thing.
--
-- Ramy, 29 Aug 2026: "there's a difference between stage three as a record
-- and stage three tutorials... everyone gets the stage one records, but not
-- everyone gets the stage one tutorials", and for Stage Three specifically:
-- whether every candidate gets one "depends on the centre".
--
-- The column was introduced as "Progress Record — Stage 3 required for this
-- candidate" -- gating the RECORD. That inverts the rule. What is
-- conditional is the TUTORIAL:
--
--   * CELTA 5 p.20 and Administration Handbook 10.2 name four triggers
--     that make a Stage Three tutorial mandatory (not to standard at Stage
--     2; at standard but not progressing; above standard but not
--     progressing; Pass B/A indications not maintained). Those are
--     computed in src/lib/stage3-triggers.ts.
--   * Handbook 10.2 also lets a centre give Stage Three to everyone --
--     centers.stage3_for_all_candidates, migration 0248.
--
-- So the record follows the triggers and the centre's own setting, and this
-- column records the tutor's judgement that THIS candidate needs the
-- tutorial. Renamed rather than dropped: every existing true value was set
-- by a tutor who had decided this candidate needed a Stage Three, which is
-- exactly what the new name means.
alter table public.celta5_records
  rename column stage3_required to stage3_tutorial_required;

comment on column public.celta5_records.stage3_tutorial_required is
  'Tutor''s judgement that this candidate needs a Stage Three TUTORIAL. Whether a Stage Three RECORD is expected is derived instead -- from the four Handbook 10.2 triggers (src/lib/stage3-triggers.ts) and centers.stage3_for_all_candidates. Renamed from stage3_required in migration 0250, which gated the record and inverted the rule.';
