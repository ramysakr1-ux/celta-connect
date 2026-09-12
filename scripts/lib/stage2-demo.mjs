// Stage 2 for the whole active cohort, at the halfway point.
//
// Handbook 10.2: Stage 2 progress checks are carried out on ALL candidates,
// with a one-to-one tutorial, "ordinarily at the halfway point (i.e., after
// 3 hours' TP and when candidates are swapping tutors/TP groups)". Found 12
// Sep 2026, three weeks into the demo course: not one candidate had a Stage
// 2 record or tutorial, the seed's one booking sheet sat on day 12 (after
// TP5) for Group A only with two of six booked, and Ramy's ported
// timetable's own "Stage 2 tutorials · ABC / DEF" on day 9 were typed as
// supervised sessions with no sheet behind them. This module is the halfway
// point the course actually had: the day-9 events carry the sheets (one per
// half, per group -- each tutor sees their own six, three at 14:15 while the
// other three write reports, three at 16:15), every active candidate booked
// and was seen, and the CELTA 5 Stage 2 record is complete for each --
// tutor's grid, candidate's self-assessment, standard, notes, both
// signatures -- except the one realistic hole (Daniel has not signed his).
//
// Shared by seed-demo.mjs and the one-off apply-to-production run, so the
// two cannot tell different stories. Idempotent: re-running updates in place.

export const CRITERIA_CODES = [
  "1a", "1b", "1c", "1d",
  "2a", "2b", "2c", "2d", "2e", "2f", "2g",
  "3a", "3b",
  "4a", "4b", "4c", "4d", "4e", "4f", "4g", "4h", "4i", "4j", "4k", "4l", "4m", "4n",
  "5a", "5b", "5c", "5d", "5e", "5f", "5g", "5h", "5i", "5j", "5k", "5l", "5m", "5n",
];

const OVERALL_BY_GRADE = {
  Fail: "not_to_standard",
  Pass: "to_standard",
  "Pass B": "above_standard",
  "Pass A": "above_standard",
};

const TUTOR_NOTES = {
  above_standard:
    "Strong, well-staged lessons with clear aims; language clarification is accurate and the learners are working for most of the lesson. Action points: cut teacher talk in feedback stages, and take a text-based lesson at the new level to widen the range.",
  to_standard:
    "Meeting the standard at this stage: aims are appropriate and the learners know what to do. Action points: stage instructions and check them before starting; plan concept questions in advance rather than improvising them; keep the timeline in view.",
  not_to_standard:
    "Not yet to standard at the halfway point -- two lessons below standard, with unclear instructions, drifting timing and passive monitoring. Action points before TP5: script and check every instruction; a written timeline per stage; monitor with a purpose and feed back on what you hear. A Stage 3 tutorial will follow (Handbook 10.2).",
};

const CANDIDATE_NOTES = {
  above_standard: "I feel confident with clarification and staging now. I want to work on talking less in feedback and on trying a skills lesson at the higher level.",
  to_standard: "Instructions are the thing I most need to fix -- I know what I want to say but it comes out too long. Timing also slips in the last stage.",
  not_to_standard: "The last two lessons went worse than I expected. I need to prepare instructions properly and check my timing; I think my monitoring is fine but the tutor disagrees.",
};

/** The tutor's per-criterion grid for a candidate, given their overall standard. */
function tutorGrid(overall, overrides) {
  const grid = {};
  for (const code of CRITERIA_CODES) grid[code] = "S";
  if (overall === "above_standard") for (const c of ["4a", "4i", "2c", "5i"]) grid[c] = "S+";
  if (overall === "not_to_standard") for (const c of ["4h", "5f", "2a"]) grid[c] = "N";
  Object.assign(grid, overrides ?? {});
  return grid;
}

/** The candidate's own column: agrees with the tutor, except one N they read as S. */
function candidateGrid(tutor, overall) {
  const grid = { ...tutor };
  if (overall === "not_to_standard") grid["5f"] = "S";
  return grid;
}

/**
 * @param supabase service-role client
 * @param ctx {
 *   courseId, halfwayDate (ISO date, course day 9),
 *   defs: [{ name, group: "A"|"B", half: 1|2, slot: 0..2, grade, withdrawn? }],
 *   traineeIdByName, subgroupIdByKey ("A1".."B2"),
 *   tutorSignatureByGroup ({ A: "M. Webb", B: "J. Blake" }),
 *   matrixOverridesByName (sparse per-candidate tutor ratings to keep)
 * }
 */
export async function seedStage2Demo(supabase, ctx) {
  const { courseId, halfwayDate, defs, traineeIdByName, subgroupIdByKey, tutorSignatureByGroup, matrixOverridesByName = {} } = ctx;
  const active = defs.filter((d) => !d.withdrawn);
  const at = (date, hhmm) => `${date}T${hhmm}:00+03:00`; // Istanbul, the demo centre's zone
  const dayBefore = (iso, n) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };

  // 1. The two halfway events, typed as what they are. The ported rows are
  //    supervised sessions by title; a Stage 2 sheet hangs off a milestone.
  const { data: events } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_time")
    .eq("course_id", courseId)
    .eq("event_date", halfwayDate)
    .ilike("title", "Stage 2 tutorials%");
  const eventByHalf = { 1: null, 2: null };
  for (const e of events ?? []) {
    const half = /ABC/.test(e.title) ? 1 : /DEF/.test(e.title) ? 2 : null;
    if (half) eventByHalf[half] = e;
    await supabase.from("course_timetable_events").update({ type: "milestone", tag: "stage2_tutorial" }).eq("id", e.id);
  }
  if (!eventByHalf[1] || !eventByHalf[2]) throw new Error("stage2-demo: the day-9 'Stage 2 tutorials · ABC/DEF' events are missing");

  // 2. One sheet per half of each group, three positions, all booked.
  const bookedAt = at(dayBefore(halfwayDate, 2), "18:10");
  for (const group of ["A", "B"]) {
    for (const half of [1, 2]) {
      const subgroupId = subgroupIdByKey[`${group}${half}`];
      const event = eventByHalf[half];
      let { data: block } = await supabase
        .from("stage2_tutorial_blocks")
        .select("id")
        .eq("course_id", courseId)
        .eq("subgroup_id", subgroupId)
        .maybeSingle();
      if (!block) {
        const { data: created, error } = await supabase
          .from("stage2_tutorial_blocks")
          .insert({ course_id: courseId, timetable_event_id: event.id, subgroup_id: subgroupId, created_by: null })
          .select("id")
          .single();
        if (error) throw error;
        block = created;
      } else {
        await supabase.from("stage2_tutorial_blocks").update({ timetable_event_id: event.id }).eq("id", block.id);
      }
      await supabase.rpc("set_stage2_slot_count", { p_block_id: block.id, p_slot_count: 3 });
      const members = active.filter((d) => d.group === group && d.half === half).sort((a, b) => a.slot - b.slot);
      // Clear, then book in slot order -- a re-run must not leave a stale name.
      await supabase.from("stage2_tutorial_slots").update({ trainee_id: null, booked_at: null }).eq("block_id", block.id);
      for (const [i, def] of members.entries()) {
        await supabase
          .from("stage2_tutorial_slots")
          .update({ trainee_id: traineeIdByName[def.name], booked_at: bookedAt })
          .eq("block_id", block.id)
          .eq("position", i + 1);
      }
    }
  }

  // 3. The record, per candidate.
  for (const def of active) {
    const overall = OVERALL_BY_GRADE[def.grade] ?? "to_standard";
    const traineeId = traineeIdByName[def.name];
    const tutorialTime = def.half === 1 ? "15:30" : "17:30";
    const candidateOverall = def.name === "Daniel Kim" ? "to_standard" : def.name === "Priya Sharma" ? "to_standard" : overall;
    const signsOff = def.name !== "Daniel Kim";
    const { error } = await supabase
      .from("celta5_records")
      .update({
        stage2_tutorial_given: true,
        stage2_hours_taught: 3,
        stage2_tutor_overall: overall,
        stage2_tutor_notes: TUTOR_NOTES[overall],
        stage2_tutor_written_assignments_notes:
          def.name === "Daniel Kim"
            ? "Focus on the Learner returned for resubmission -- work through the criteria comments before the deadline. Language Related Tasks not yet in."
            : "Focus on the Learner passed at first submission. Language Related Tasks in and being marked.",
        stage2_tutor_other_notes: def.name === "Kofi Mensah" ? "Attendance is below where it should be -- discussed; see the attendance record." : null,
        stage2_completed_at: at(halfwayDate, tutorialTime),
        stage2_tutor_signature_name: tutorSignatureByGroup[def.group],
        stage2_candidate_submitted_at: at(dayBefore(halfwayDate, 1), "19:00"),
        stage2_candidate_overall: candidateOverall,
        stage2_candidate_notes: CANDIDATE_NOTES[candidateOverall],
        stage2_candidate_written_assignments_notes: def.name === "Daniel Kim" ? "I am reworking Focus on the Learner." : "Both assignments in.",
        stage2_candidate_other_notes: null,
        trainee_signoff_stage2_at: signsOff ? at(halfwayDate, "20:00") : null,
        stage2_candidate_signature_name: signsOff ? def.name : null,
        // Handbook 10.2: not to standard at Stage 2 is the first Stage 3
        // trigger -- the tutor flags it there and then. Others keep whatever
        // the seed decided (Priya's footnote-2 higher-grade tutorial).
        ...(overall === "not_to_standard" ? { stage3_tutorial_required: true } : {}),
      })
      .eq("trainee_id", traineeId);
    if (error) throw error;

    // 4. The grid, both columns, every criterion.
    const tutor = tutorGrid(overall, matrixOverridesByName[def.name]);
    const candidate = candidateGrid(tutor, overall);
    const rows = CRITERIA_CODES.map((code) => ({
      course_id: courseId,
      trainee_id: traineeId,
      criteria_code: code,
      tutor_status_stage2: tutor[code],
      candidate_status: candidate[code],
    }));
    const { error: mErr } = await supabase.from("celta5_matrix").upsert(rows, { onConflict: "trainee_id,criteria_code" });
    if (mErr) throw mErr;
  }
  return { candidates: active.length };
}
