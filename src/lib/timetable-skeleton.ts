import type { Database } from "@/lib/supabase/types";

type EventType = Database["public"]["Tables"]["course_timetable_events"]["Row"]["type"];
type AssignmentType = Database["public"]["Tables"]["assignments"]["Row"]["assignment_type"];

export interface SkeletonEventDraft {
  type: EventType;
  title: string;
  /**
   * Position in the course as a fraction of the total teaching days (0 =
   * first day, 1 = last day), not a fixed day count -- lets the same shape
   * stretch or compress to fit any course length/meeting pattern rather
   * than being locked to one specific week count.
   */
  position: number;
  time?: string;
  tag?: string;
  linkedAssignmentType?: AssignmentType;
  linkedTpNumber?: number;
  /**
   * "Every sub-criterion names the session that teaches it" --
   * project_spec_audit_2026-08-18's assessment-model.md link 1, seeded
   * from Ramy's INPUT_WEEKS mapping (2026-08-18): the exact CELTA
   * criteria codes this session introduces. Feeds
   * peer-observation.ts's criteriaForTpDate once the skeleton is
   * generated -- input session -> criterion -> TP point -> peer task.
   */
  inputSessionCriteria?: string[];
}

export const DEFAULT_TEACHING_DAYS = 20; // standard full-time CELTA: 4 weeks, Mon-Fri
export const DEFAULT_MEETING_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri (0 = Sun ... 6 = Sat)

// §1.1a-skel -- the standard CELTA course shape trainers duplicate and
// anchor to a real start date, rather than building a timetable from a
// blank list. Deliberately a reasonable, editable STARTING POINT (matches
// the doc's "flexible while building, trainer tweaks exceptions" framing) --
// not a claim of exact pedagogical timing, which the architecture-plan.md
// explicitly reserves to CELTA-Connect-content-architecture.md.
//
// design_handoff_timetable_decisions, 2026-08-17: rebuilt from
// Timetable Refresh.dc.html's own FULL (four-week) reference, day by day --
// the previous version predated the two-halves-alternate-calendar-days
// model rotation.ts and the Rotation page already run on, and generated
// exactly one course-wide "tp" event per round instead of two (one per
// half). Every TP round below is now two entries, on two consecutive
// teaching days, tagged with the same linkedTpNumber -- that's the whole
// mechanism halfTpDates()/halfOwningDate() need, no separate "which half"
// column on the event itself.
//
// Assignment due dates are NOT baked into this skeleton as fixed offsets
// any more (see assignment-due-dates.ts's for-claude-code-assignment-
// schedule-rule.md-driven resolver, which recomputes assignments.due_date
// from the real rotation whenever the timetable locks or pairing changes).
// The assignment_due/resubmission_due tiles below are the informational
// timetable display only, positioned to match the same reference so the
// grid and the resolver tell the same story on a freshly generated course.
function pos(day: number): number {
  return day / (DEFAULT_TEACHING_DAYS - 1);
}

export const STANDARD_CELTA_SKELETON: SkeletonEventDraft[] = [
  // Day 0 (Mon) -- orientation, demo, FOL's own teaching slot (FOL is
  // "released" the moment it's taught, not a separate milestone).
  { type: "milestone", title: "Course begins -- orientation", position: pos(0), time: "10:00", tag: "whole_group" },
  // Ramy's INPUT_WEEKS mapping, 2026-08-18: Day 1 carries three sessions,
  // not one -- the old single "Introduction to CELTA & Learner Needs"
  // placeholder is split into the two real sessions it stood in for.
  {
    type: "input_session",
    title: "Classroom management",
    position: pos(0),
    time: "10:00",
    tag: "whole_group",
    inputSessionCriteria: ["5b", "5d", "5f", "5i", "5j", "5k", "4g", "1d"],
  },
  { type: "milestone", title: "Demo lesson (trainer-led)", position: pos(0), time: "12:45", tag: "whole_group" },
  {
    type: "input_session",
    title: "Focus on the Learner -- the assignment session",
    position: pos(0),
    time: "13:30",
    tag: "whole_group",
    linkedAssignmentType: "Focus on Learner",
    inputSessionCriteria: ["1a", "1b", "1c"],
  },
  {
    type: "input_session",
    title: "Classroom arrangements and material use",
    position: pos(0),
    time: "15:30",
    tag: "whole_group",
    inputSessionCriteria: ["5a", "5e", "4d"],
  },

  // Day 1-2 (Tue/Wed) -- TP1, one half each day.
  { type: "tp", title: "TP1 -- Half A", position: pos(1), time: "10:00", tag: "individual", linkedTpNumber: 1 },
  {
    type: "input_session",
    title: "Lesson planning input",
    position: pos(1),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["4a", "4b", "4e", "4f", "4h", "4j", "4k", "4m", "4n"],
  },
  {
    type: "input_session",
    title: "Receptive skills",
    position: pos(1),
    time: "16:00",
    tag: "whole_group",
    inputSessionCriteria: ["3a", "4l"],
  },
  { type: "tp", title: "TP1 -- Half B", position: pos(2), time: "10:00", tag: "individual", linkedTpNumber: 1 },
  {
    type: "input_session",
    title: "Eliciting and concept checking",
    position: pos(2),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["5g", "2c", "2e"],
  },
  {
    // "2c overlaps with PPP and Eliciting -- first session to teach it
    // still gates it" (Ramy) -- this is that first session; criteria
    // recorded here so criteriaForTpDate() reflects THIS session's own
    // focus, same as every other row.
    type: "input_session",
    title: "Teaching vocabulary",
    position: pos(2),
    time: "16:00",
    tag: "whole_group",
    inputSessionCriteria: ["2a", "2c"],
  },
  { type: "milestone", title: "Filmed observation 1", position: pos(2), time: "17:00", tag: "individual" },

  // Day 3-4 (Thu/Fri) -- TP2, one half each day. SRT released day 3
  // (Timetable Refresh.dc.html FULL week 1, "9"), Stage 1 tutorials begin
  // once both halves have TP2 behind them (day 4).
  { type: "tp", title: "TP2 -- Half A", position: pos(3), time: "10:00", tag: "individual", linkedTpNumber: 2 },
  {
    type: "input_session",
    title: "PPP",
    position: pos(3),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["5c", "4b", "4f", "2c"],
  },
  {
    type: "input_session",
    title: "Text-based teaching",
    position: pos(3),
    time: "16:00",
    tag: "whole_group",
    inputSessionCriteria: ["3a", "3b", "4c"],
  },
  { type: "milestone", title: "Language Skills Related Tasks released", position: pos(3), time: "17:00", tag: "whole_group" },
  { type: "tp", title: "TP2 -- Half B", position: pos(4), time: "10:00", tag: "individual", linkedTpNumber: 2 },
  {
    // "overlaps with Language analysis 1 on 4i" (Ramy) -- both rows below
    // carry 4i; whichever the trainer actually runs later that day wins
    // via criteriaForTpDate()'s own "most recent session" rule, same as
    // every other overlap in this mapping.
    type: "input_session",
    title: "Sounds",
    position: pos(4),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["2e", "4i"],
  },
  {
    type: "input_session",
    title: "Language analysis 1",
    position: pos(4),
    time: "16:00",
    tag: "whole_group",
    inputSessionCriteria: ["4i", "2b", "2f"],
  },
  { type: "milestone", title: "Filmed observation 2", position: pos(4), time: "17:00", tag: "individual" },
  { type: "milestone", title: "Stage 1 tutorials begin", position: pos(4), time: "14:30", tag: "individual" },

  // Day 5-6 (Mon/Tue) -- TP3. Skills (SRT) is due the day after each
  // half's own TP3 -- for Half A that's Half B's TP3 day (day 6); Half B's
  // own due tile lands on day 7 below (assignment-due-dates.ts resolves
  // the real per-trainee date; this tile is the display-only echo of it).
  { type: "tp", title: "TP3 -- Half A", position: pos(5), time: "10:00", tag: "individual", linkedTpNumber: 3 },
  {
    type: "input_session",
    title: "Giving feedback on tasks",
    position: pos(5),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["5h"],
  },
  {
    type: "input_session",
    title: "Providing models -- drilling",
    position: pos(5),
    time: "16:00",
    tag: "whole_group",
    // "This is the ONLY session touching 2d's session-taught aspects --
    // but per build-spec.md, 2d itself is also a standing baseline
    // requirement from day one, not purely session-gated" (Ramy).
    inputSessionCriteria: ["2d"],
  },
  { type: "tp", title: "TP3 -- Half B", position: pos(6), time: "10:00", tag: "individual", linkedTpNumber: 3 },
  {
    type: "input_session",
    title: "Staging controlled practice",
    position: pos(6),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["2g"],
  },
  {
    type: "input_session",
    title: "Portfolio and record-keeping",
    position: pos(6),
    time: "16:00",
    tag: "whole_group",
    inputSessionCriteria: ["5l"],
  },
  { type: "milestone", title: "Filmed observation 3", position: pos(6), time: "17:00", tag: "individual" },
  {
    type: "assignment_due",
    title: "Language Skills Related Tasks -- due 9am (Half A)",
    position: pos(6),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "Skills",
  },

  // Day 7-8 (Wed/Thu) -- TP4. Half B's Skills due lands the day after
  // their own TP3, which is Half A's TP4 day.
  { type: "tp", title: "TP4 -- Half A", position: pos(7), time: "10:00", tag: "individual", linkedTpNumber: 4 },
  {
    type: "input_session",
    title: "Self-evaluation and responding to feedback",
    position: pos(7),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["5m", "5n"],
  },
  {
    // "Second pass -- 4c already introduced day 4" (Ramy, Text-based
    // teaching). Recorded again here so criteriaForTpDate() picks it up
    // as the live focus for TPs from this point on, per the "gate on the
    // first session, but each session's own row still reflects what it
    // itself reinforces" reading of the mapping.
    type: "input_session",
    title: "Adapting materials for level",
    position: pos(7),
    time: "16:00",
    tag: "whole_group",
    inputSessionCriteria: ["4c"],
  },
  {
    type: "assignment_due",
    title: "Language Skills Related Tasks -- due 9am (Half B)",
    position: pos(7),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "Skills",
  },
  { type: "tp", title: "TP4 -- Half B", position: pos(8), time: "10:00", tag: "individual", linkedTpNumber: 4 },
  { type: "milestone", title: "Filmed observation 4", position: pos(8), time: "17:00", tag: "individual" },
  { type: "milestone", title: "Language Related Tasks released", position: pos(8), time: "17:00", tag: "whole_group" },

  // Day 9 (Fri) -- no TP: demo lesson 2 / new level, FOL's divergence
  // session (comparing pooled notes before claiming), LRT due for both
  // groups at once since neither is teaching TP that day.
  { type: "milestone", title: "Demo lesson 2 -- new level", position: pos(9), time: "10:00", tag: "whole_group" },
  {
    // "Second pass for the level change" (Ramy) -- pairs naturally with
    // the demo-lesson-2/new-level milestone already on this day.
    type: "input_session",
    title: "Teaching a new level -- needs analysis",
    position: pos(9),
    time: "11:00",
    tag: "whole_group",
    inputSessionCriteria: ["1a", "1c"],
  },
  { type: "milestone", title: "FOL divergence session", position: pos(9), time: "14:30", tag: "whole_group" },
  {
    type: "assignment_due",
    title: "Language Related Tasks -- due 9am, both groups",
    position: pos(9),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "LRT",
  },

  // Day 10-11 (Mon/Tue) -- TP5, new level. FOL itself is due day 11
  // (course day 12), a whole-cohort date -- see COHORT_DAY_ASSIGNMENTS in
  // assignment-due-dates.ts.
  { type: "tp", title: "TP5 -- Half A", position: pos(10), time: "10:00", tag: "individual", linkedTpNumber: 5 },
  { type: "milestone", title: "Stage 2 tutorials begin", position: pos(10), time: "14:30", tag: "individual" },
  {
    // Ramy, 2026-08-18 correction: no "3c" -- speaking and writing are one
    // combined criterion, 3b, per the certified CELTA 5 (Appendix 1):
    // "helping learners to produce oral and written language." 3b is
    // FIRST introduced in Text-based teaching (day 4 above), which is
    // where it gates live from; these are the two dedicated reinforcing
    // passes named in the mapping, Week 3+. No exact day was given for
    // either -- placed here, alongside the existing new-level TP5 cluster,
    // as a reasonable estimate that doesn't change the gate either way.
    type: "input_session",
    title: "Teaching speaking",
    position: pos(10),
    time: "16:00",
    tag: "whole_group",
    inputSessionCriteria: ["3b"],
  },
  { type: "tp", title: "TP5 -- Half B", position: pos(11), time: "10:00", tag: "individual", linkedTpNumber: 5 },
  {
    type: "input_session",
    title: "Productive skills -- writing",
    position: pos(11),
    time: "14:30",
    tag: "whole_group",
    inputSessionCriteria: ["3b"],
  },
  {
    type: "assignment_due",
    title: "Focus on the Learner -- due 9am",
    position: pos(11),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "Focus on Learner",
  },

  // Day 12-13 (Wed/Thu) -- TP6. Skills resubmission and LfC's release sit
  // here, mirroring the reference.
  { type: "tp", title: "TP6 -- Half A", position: pos(12), time: "10:00", tag: "individual", linkedTpNumber: 6 },
  {
    type: "resubmission_due",
    title: "Language Skills Related Tasks -- resubmission due, both groups",
    position: pos(12),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "Skills",
  },
  { type: "tp", title: "TP6 -- Half B", position: pos(13), time: "10:00", tag: "individual", linkedTpNumber: 6 },
  { type: "milestone", title: "Lessons from the Classroom released", position: pos(13), time: "17:00", tag: "whole_group" },

  // Day 14 (Fri) -- no TP: syllabus planning, FOL resubmission due.
  { type: "input_session", title: "Syllabus planning", position: pos(14), time: "10:00", tag: "whole_group" },
  {
    type: "resubmission_due",
    title: "Focus on the Learner -- resubmission due, both groups",
    position: pos(14),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "Focus on Learner",
  },

  // Day 15-16 (Mon/Tue) -- TP7. LfC anchors to this round specifically
  // (not "the day after your own last TP") -- each half is due on the
  // OTHER half's TP7 day, giving both a symmetric gap after TP7 and before
  // TP8, the final assessed lesson.
  { type: "tp", title: "TP7 -- Half A", position: pos(15), time: "10:00", tag: "individual", linkedTpNumber: 7 },
  {
    type: "assignment_due",
    title: "Lessons from the Classroom -- due 9am (Half B)",
    position: pos(15),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "LfC",
  },
  { type: "tp", title: "TP7 -- Half B", position: pos(16), time: "10:00", tag: "individual", linkedTpNumber: 7 },
  {
    type: "assignment_due",
    title: "Lessons from the Classroom -- due 9am (Half A)",
    position: pos(16),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "LfC",
  },

  // Day 17-18 (Wed/Thu) -- TP8, the final assessed lesson for each half.
  // LRT and LfC resubmissions both land day 18, mirroring the reference
  // (flagged there as clustering worth spreading out once real pacing is
  // tested -- kept as-is here for the same reason).
  { type: "tp", title: "TP8 -- Half A", position: pos(17), time: "10:00", tag: "individual", linkedTpNumber: 8 },
  { type: "milestone", title: "Filmed observation 5", position: pos(17), time: "17:00", tag: "individual" },
  { type: "tp", title: "TP8 -- Half B", position: pos(18), time: "10:00", tag: "individual", linkedTpNumber: 8 },
  { type: "input_session", title: "Reflective Practice & Professional Development", position: pos(18), time: "14:30", tag: "whole_group" },
  {
    type: "resubmission_due",
    title: "Language Related Tasks -- resubmission due, both groups",
    position: pos(18),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "LRT",
  },
  {
    type: "resubmission_due",
    title: "Lessons from the Classroom -- resubmission due, both groups",
    position: pos(18),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "LfC",
  },

  // Day 19 (Fri) -- close.
  { type: "milestone", title: "Course ends -- final feedback", position: pos(19), time: "15:30", tag: "whole_group" },
];

// design_handoff_mixed_mode_part_time, for-claude-code-part-time-week-view.md:
// "Full-course summary" (12 weeks, Sat+Wed) already existed as design
// content (PART_TIME in Timetable Refresh.dc.html) but was never ported
// into real code -- the standard shape's own relative-position stretch
// (buildSkeletonEvents with custom totalTeachingDays/meetingDays) already
// covers the five-week Fridays/Wednesdays-off shapes correctly (verified:
// same 20-session content, just spread over 4 meeting days/week instead of
// 5), but part-time's rhythm is qualitatively different -- ABC and DEF are
// two independent, unpaired TP groups that each meet on their OWN fixed
// weekday (Saturday / Wednesday), not two halves of one group alternating
// daily. Two "tp" events per round still, same linkedTpNumber, same
// mechanism rotation.ts's halfTpDates()/halfOwningDate() already read --
// just spread a week apart instead of a day apart, and named for the real
// group rather than "Half A/B" since a part-time TP group isn't split.
//
// Content anchors taken directly from PART_TIME where the source gives
// them explicitly (orientation, unassessed teaching, TP1 + SRT set, TP8 +
// LFC due, LFC due (ABC) + resubmission clinic, final tutorials +
// resubmissions due, final resubmissions + portfolio completion, grade
// meeting + close). PART_TIME's "Weeks 3-9, same pattern" is an
// abbreviated placeholder in the source, not literal week-by-week content --
// interpolated here as TP2-TP7 one round per week with a level-change/
// divergence week after TP4, before TP5 (the same position every other
// shape uses), since that's the one demonstrably consistent structure
// across all four shapes rather than an invented one.
function partTimePos(slot: number): number {
  return slot / 23; // 24 sessions, slots 0-23
}

// 2026-08-19, the deferred follow-up now done: the 22 named input sessions
// (STANDARD_CELTA_SKELETON's own list, criteria tags included) placed onto
// part-time's 24-slot structure. No source document names which session
// goes on which part-time week -- PART_TIME's own text abbreviates weeks
// 3-9 as "same pattern" -- so this is a deliberate interpolation, not a
// transcription: Ramy's original full-time ORDER is preserved exactly
// (pre-TP1 content first, then one session tracking each TP round in
// sequence, the two Week-3+ reinforcing passes and the closing sessions
// last), compressed from full-time's 2-3-per-day density to one new
// session per part-time week, since a week here plays the role a single
// full-time day does. Every session keeps the exact criteria array it
// carries in STANDARD_CELTA_SKELETON, including "Focus on the Learner" and
// the renamed "Classroom management" opener, which the old placeholder
// version of this file carried NO criteria for at all -- criteriaForTpDate
// silently had nothing to gate on for any part-time course before this.
export const PART_TIME_SKELETON: SkeletonEventDraft[] = [
  { type: "milestone", title: "Course begins -- orientation", position: partTimePos(0), time: "10:00", tag: "whole_group" },
  {
    // Full-time's own day-0 split of the old single placeholder (see
    // STANDARD_CELTA_SKELETON above) -- same fix applied here.
    type: "input_session",
    title: "Classroom management",
    position: partTimePos(0),
    time: "10:00",
    tag: "whole_group",
    inputSessionCriteria: ["5b", "5d", "5f", "5i", "5j", "5k", "4g", "1d"],
  },
  { type: "milestone", title: "Demo lesson (trainer-led)", position: partTimePos(0), time: "13:45", tag: "whole_group" },

  { type: "milestone", title: "Unassessed teaching -- all six meet the learners", position: partTimePos(1), time: "10:00", tag: "whole_group" },
  {
    type: "input_session",
    title: "Focus on the Learner -- the assignment session",
    position: partTimePos(1),
    time: "13:45",
    tag: "whole_group",
    linkedAssignmentType: "Focus on Learner",
    inputSessionCriteria: ["1a", "1b", "1c"],
  },
  {
    // Full-time's day-0 order has this LAST, after Focus on the Learner --
    // kept in that same relative order here, on the last shared day before
    // groups split for TP1.
    type: "input_session",
    title: "Classroom arrangements and material use",
    position: partTimePos(1),
    time: "15:00",
    tag: "whole_group",
    inputSessionCriteria: ["5a", "5e", "4d"],
  },

  { type: "tp", title: "TP1 -- Group ABC", position: partTimePos(2), time: "10:00", tag: "individual", linkedTpNumber: 1 },
  { type: "milestone", title: "Language Skills Related Tasks released", position: partTimePos(2), time: "17:00", tag: "whole_group" },
  {
    type: "input_session",
    title: "Lesson planning input",
    position: partTimePos(2),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["4a", "4b", "4e", "4f", "4h", "4j", "4k", "4m", "4n"],
  },
  { type: "tp", title: "TP1 -- Group DEF", position: partTimePos(3), time: "10:00", tag: "individual", linkedTpNumber: 1 },
  {
    type: "input_session",
    title: "Receptive skills",
    position: partTimePos(3),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["3a", "4l"],
  },

  { type: "tp", title: "TP2 -- Group ABC", position: partTimePos(4), time: "10:00", tag: "individual", linkedTpNumber: 2 },
  {
    type: "input_session",
    title: "Eliciting and concept checking",
    position: partTimePos(4),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["5g", "2c", "2e"],
  },
  { type: "tp", title: "TP2 -- Group DEF", position: partTimePos(5), time: "10:00", tag: "individual", linkedTpNumber: 2 },
  { type: "milestone", title: "Filmed observation 1", position: partTimePos(5), time: "17:00", tag: "individual" },
  {
    type: "input_session",
    title: "Teaching vocabulary",
    position: partTimePos(5),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["2a", "2c"],
  },

  { type: "tp", title: "TP3 -- Group ABC", position: partTimePos(6), time: "10:00", tag: "individual", linkedTpNumber: 3 },
  {
    type: "input_session",
    title: "PPP",
    position: partTimePos(6),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["5c", "4b", "4f", "2c"],
  },
  { type: "tp", title: "TP3 -- Group DEF", position: partTimePos(7), time: "10:00", tag: "individual", linkedTpNumber: 3 },
  {
    type: "assignment_due",
    title: "Language Skills Related Tasks -- due 9am (Group ABC)",
    position: partTimePos(7),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "Skills",
  },
  {
    type: "input_session",
    title: "Text-based teaching",
    position: partTimePos(7),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["3a", "3b", "4c"],
  },

  { type: "tp", title: "TP4 -- Group ABC", position: partTimePos(8), time: "10:00", tag: "individual", linkedTpNumber: 4 },
  {
    type: "assignment_due",
    title: "Language Skills Related Tasks -- due 9am (Group DEF)",
    position: partTimePos(8),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "Skills",
  },
  {
    // "overlaps with Language analysis 1 on 4i" (Ramy, full-time) -- same
    // overlap carried over here, resolved the same way there: whichever
    // session actually runs later that week wins via criteriaForTpDate().
    type: "input_session",
    title: "Sounds",
    position: partTimePos(8),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["2e", "4i"],
  },
  { type: "tp", title: "TP4 -- Group DEF", position: partTimePos(9), time: "10:00", tag: "individual", linkedTpNumber: 4 },
  { type: "milestone", title: "Filmed observation 2", position: partTimePos(9), time: "17:00", tag: "individual" },
  { type: "milestone", title: "Language Related Tasks released", position: partTimePos(9), time: "17:00", tag: "whole_group" },
  {
    type: "input_session",
    title: "Language analysis 1",
    position: partTimePos(9),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["4i", "2b", "2f"],
  },

  // No TP this week -- level change, mirroring every other shape's own gap.
  { type: "milestone", title: "Demo lesson 2 -- new level", position: partTimePos(10), time: "10:00", tag: "whole_group" },
  {
    // Same pairing as full-time's own day-9: this session sits right
    // alongside the new-level demo lesson, before FOL divergence.
    type: "input_session",
    title: "Teaching a new level -- needs analysis",
    position: partTimePos(10),
    time: "11:00",
    tag: "whole_group",
    inputSessionCriteria: ["1a", "1c"],
  },
  { type: "milestone", title: "FOL divergence session", position: partTimePos(10), time: "13:45", tag: "whole_group" },
  {
    type: "assignment_due",
    title: "Language Related Tasks -- due 9am, both groups",
    position: partTimePos(11),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "LRT",
  },

  { type: "tp", title: "TP5 -- Group ABC", position: partTimePos(12), time: "10:00", tag: "individual", linkedTpNumber: 5 },
  { type: "milestone", title: "Stage 1 tutorials begin", position: partTimePos(12), time: "13:45", tag: "individual" },
  {
    type: "input_session",
    title: "Giving feedback on tasks",
    position: partTimePos(12),
    time: "15:00",
    tag: "whole_group",
    inputSessionCriteria: ["5h"],
  },
  { type: "tp", title: "TP5 -- Group DEF", position: partTimePos(13), time: "10:00", tag: "individual", linkedTpNumber: 5 },
  {
    type: "assignment_due",
    title: "Focus on the Learner -- due 9am",
    position: partTimePos(13),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "Focus on Learner",
  },
  {
    type: "input_session",
    title: "Providing models -- drilling",
    position: partTimePos(13),
    time: "13:45",
    tag: "whole_group",
    // "This is the ONLY session touching 2d's session-taught aspects --
    // 2d itself is also a standing baseline requirement from day one, not
    // purely session-gated" (Ramy, full-time -- same note applies here).
    inputSessionCriteria: ["2d"],
  },

  { type: "tp", title: "TP6 -- Group ABC", position: partTimePos(14), time: "10:00", tag: "individual", linkedTpNumber: 6 },
  { type: "milestone", title: "Stage 2 tutorials begin", position: partTimePos(14), time: "13:45", tag: "individual" },
  {
    type: "input_session",
    title: "Staging controlled practice",
    position: partTimePos(14),
    time: "15:00",
    tag: "whole_group",
    inputSessionCriteria: ["2g"],
  },
  { type: "tp", title: "TP6 -- Group DEF", position: partTimePos(15), time: "10:00", tag: "individual", linkedTpNumber: 6 },
  { type: "milestone", title: "Filmed observation 3", position: partTimePos(15), time: "17:00", tag: "individual" },
  {
    type: "input_session",
    title: "Portfolio and record-keeping",
    position: partTimePos(15),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["5l"],
  },

  { type: "tp", title: "TP7 -- Group ABC", position: partTimePos(16), time: "10:00", tag: "individual", linkedTpNumber: 7 },
  {
    type: "resubmission_due",
    title: "Language Skills Related Tasks -- resubmission due, both groups",
    position: partTimePos(16),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "Skills",
  },
  {
    type: "input_session",
    title: "Self-evaluation and responding to feedback",
    position: partTimePos(16),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["5m", "5n"],
  },
  { type: "tp", title: "TP7 -- Group DEF", position: partTimePos(17), time: "10:00", tag: "individual", linkedTpNumber: 7 },
  { type: "milestone", title: "Lessons from the Classroom released", position: partTimePos(17), time: "17:00", tag: "whole_group" },
  {
    // Second pass -- 4c already introduced in Text-based teaching above,
    // same reinforcing-pass reasoning as full-time.
    type: "input_session",
    title: "Adapting materials for level",
    position: partTimePos(17),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["4c"],
  },

  // TP8 -- the final assessed lesson for each group.
  { type: "tp", title: "TP8 -- Group ABC, final assessed", position: partTimePos(18), time: "10:00", tag: "individual", linkedTpNumber: 8 },
  { type: "milestone", title: "Filmed observation 4", position: partTimePos(18), time: "17:00", tag: "individual" },
  {
    // No exact week given for either of the two Week-3+ reinforcing
    // passes in the original mapping (full-time placed them as a
    // reasonable estimate too) -- kept alongside the final TP round here,
    // the same relative position full-time uses.
    type: "input_session",
    title: "Teaching speaking",
    position: partTimePos(18),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["3b"],
  },
  { type: "tp", title: "TP8 -- Group DEF", position: partTimePos(19), time: "10:00", tag: "individual", linkedTpNumber: 8 },
  {
    type: "assignment_due",
    title: "Lessons from the Classroom -- due 9am (Group DEF)",
    position: partTimePos(19),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "LfC",
  },
  {
    type: "input_session",
    title: "Productive skills -- writing",
    position: partTimePos(19),
    time: "13:45",
    tag: "whole_group",
    inputSessionCriteria: ["3b"],
  },

  { type: "milestone", title: "Resubmission clinic", position: partTimePos(20), time: "10:00", tag: "whole_group" },
  {
    type: "assignment_due",
    title: "Lessons from the Classroom -- due 9am (Group ABC)",
    position: partTimePos(20),
    time: "09:00",
    tag: "individual",
    linkedAssignmentType: "LfC",
  },
  { type: "input_session", title: "Syllabus planning", position: partTimePos(20), time: "13:45", tag: "whole_group" },

  { type: "milestone", title: "Final tutorials", position: partTimePos(21), time: "10:00", tag: "individual" },
  {
    type: "resubmission_due",
    title: "Language Related Tasks -- resubmission due, both groups",
    position: partTimePos(21),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "LRT",
  },
  {
    type: "resubmission_due",
    title: "Lessons from the Classroom -- resubmission due, both groups",
    position: partTimePos(21),
    time: "09:00",
    tag: "whole_group",
    linkedAssignmentType: "LfC",
  },
  {
    type: "input_session",
    title: "Reflective Practice & Professional Development",
    position: partTimePos(21),
    time: "13:45",
    tag: "whole_group",
  },

  { type: "milestone", title: "Portfolio completion", position: partTimePos(22), time: "10:00", tag: "whole_group" },
  {
    type: "resubmission_due",
    title: "Final resubmissions due, both groups",
    position: partTimePos(22),
    time: "09:00",
    tag: "whole_group",
  },

  { type: "milestone", title: "Grade meeting", position: partTimePos(23), time: "10:00", tag: "whole_group" },
  { type: "milestone", title: "Course ends -- course close", position: partTimePos(23), time: "13:45", tag: "whole_group" },
];

/**
 * Adds `sessionOffset` course-meeting-days to an ISO date string, counting
 * only days whose weekday is in `meetingDays` (0 = Sun ... 6 = Sat). Covers
 * both full-time (Mon-Fri) and part-time (e.g. Tue/Thu/Sat evenings)
 * patterns with the same function. Formats the result from local date
 * components rather than `toISOString()`, which round-trips through UTC
 * and silently shifts the date by a day whenever the server's timezone is
 * ahead of UTC (e.g. Europe/Istanbul -- caught this live).
 */
export function addSessionDays(isoDate: string, sessionOffset: number, meetingDays: number[]): string {
  const date = new Date(`${isoDate}T00:00:00`);
  let remaining = sessionOffset;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (meetingDays.includes(date.getDay())) remaining -= 1;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Scales the standard skeleton to any total teaching-day count and any set
 * of meeting weekdays -- a 5-week or part-time course is the same relative
 * shape (TP1 still lands early, VO3/Stage 2/final assignment still cluster
 * near the end) stretched over more/different session days, not a
 * different hand-authored skeleton.
 */
export function buildSkeletonEvents(
  startDate: string,
  totalTeachingDays: number = DEFAULT_TEACHING_DAYS,
  meetingDays: number[] = DEFAULT_MEETING_DAYS,
  skeleton: SkeletonEventDraft[] = STANDARD_CELTA_SKELETON
) {
  const lastIndex = Math.max(totalTeachingDays - 1, 1);
  return skeleton.map((draft) => {
    const sessionOffset = Math.round(draft.position * lastIndex);
    return {
      type: draft.type,
      title: draft.title,
      event_date: addSessionDays(startDate, sessionOffset, meetingDays),
      event_time: draft.time ?? null,
      tag: draft.tag ?? null,
      linked_assignment_type: draft.linkedAssignmentType ?? null,
      linked_tp_number: draft.linkedTpNumber ?? null,
      input_session_criteria: draft.inputSessionCriteria ?? [],
    };
  });
}
