// The final day, for a course the harness plants as finished (--stage
// finished). Handbook 10.2 (final progress record for all), 12.1.3 (the
// CELTA 5's final page signed by tutor and candidate at the end of the
// course), 7.11 (the end-of-course report: mode, hours attended, overall
// grade, planning-and-teaching grade, written-assignments grade, comments)
// and 14.4 (reports not before the final day). Until 12 Sep 2026 a finished
// demo course had none of it: no final grades, no signatures, no reports.
// Idempotent; only for a course whose end date has passed.

const GRADES = { Fail: "Fail", Pass: "Pass", "Pass B": "Pass B", "Pass A": "Pass A" };

export async function seedFinalDayDemo(supabase, ctx) {
  const { courseId, endDate, defs, traineeIdByName, groupByName, tutorSignatureByGroup, assignmentFailByName = {} } = ctx;
  const at = (date, hhmm) => `${date}T${hhmm}:00+03:00`;
  const dayAfter = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  let done = 0;
  for (const def of defs) {
    const traineeId = traineeIdByName[def.name];
    if (!traineeId) continue;
    if (def.withdrawn) {
      await supabase.from("celta5_records").update({ final_recommended_grade: "Withdrawn" }).eq("trainee_id", traineeId);
      continue;
    }
    const overall = GRADES[def.grade] ?? "Pass";
    const failedAssignment = Boolean(assignmentFailByName[def.name]);
    const stage3 = def.grade === "Fail" || def.name === "Priya Sharma";
    const { error } = await supabase
      .from("celta5_records")
      .update({
        final_recommended_grade: overall,
        final_teaching_grade: overall,
        final_assignments_grade: failedAssignment ? "Fail" : "Pass",
        overall_notes:
          overall === "Fail"
            ? "Did not meet the assessment criteria consistently by the end of the course: instructions and monitoring remained below standard in TP7 and TP8 despite the action points at Stage 3. Written work: one assignment failed after resubmission."
            : overall === "Pass"
              ? "Met all the assessment criteria by the end of the course. Strengths: rapport, clear aims, appropriate materials. For development: reduce teacher talk in feedback stages; plan concept checking in advance."
              : "Consistently above the standard expected, with independent planning and well-managed learning across both levels. For development: a wider range of lesson types and more principled use of the coursebook.",
        grade_review_tutor_comments: stage3
          ? overall === "Fail"
            ? "The action points in the Stage 3 record were not demonstrated in the final lessons: TP7 instructions were again unchecked and TP8 ran over time with passive monitoring."
            : "The action points in the Stage 3 record were demonstrated in TP7 and TP8 -- consistency across the criteria and independence in planning."
          : null,
        trainer_signoff_final_at: at(endDate, "16:30"),
        final_tutor_signature_name: tutorSignatureByGroup[groupByName[def.name]],
        trainee_signoff_final_at: at(endDate, "17:00"),
        final_checklist_tp: true,
        final_checklist_observations: true,
        final_checklist_assignments: true,
        final_checklist_own_work: true,
        final_checklist_all_records: true,
        final_candidate_signature_name: def.name,
        final_report_released_at: at(dayAfter(endDate), "10:00"),
      })
      .eq("trainee_id", traineeId);
    if (error) throw error;
    done += 1;
  }
  return { candidates: done };
}
