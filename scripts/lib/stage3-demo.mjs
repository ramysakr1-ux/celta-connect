// Stage 3 and the fail letter, in the final third.
//
// Handbook 10.2: Stage 3 "must be completed by tutors in the final third of
// the course" for every triggered candidate -- "a tutorial must be given and
// the whole tutorial record completed" -- and "potential Fail candidates
// should also be issued with a Fail letter... ideally with at least two
// lessons left to teach". Found 12 Sep 2026, with TP7 and TP8 the only
// lessons left: Daniel and Ines (provisional Fail/Pass, not to standard at
// Stage 2) had no Stage 3 invite, tutorial, record or letter, and the ported
// timetable's three "Stage 3 tutorials · By invitation" slots on day 15 had
// nobody in them. This is the day 15 the course actually had: three
// invites (Daniel, Ines, and Priya -- Handbook footnote 2, a Pass A
// indication made explicit), three records completed and signed, two fail
// letters issued with two lessons still to teach; Daniel has acknowledged
// his, Ines has not yet.
//
// Shared by seed-demo.mjs and the one-off apply-to-production run. Idempotent.

const CANDIDATES = [
  {
    name: "Daniel Kim",
    time: "14:15",
    overall: "not_to_standard",
    letter: true,
    acknowledges: true,
    candidateSigns: false,
    notes:
      "Not to standard entering the final third. TP5 and TP6 improved on instructions but monitoring is still passive and timing drifts in the last stage. Action points for TP7 and TP8: a written stage-by-stage timeline with a checked clock; instructions scripted and checked with ICQs; monitor with a purpose and use what you hear in feedback. Focus on the Learner resubmission is due -- address the criteria comments. A Fail letter follows this tutorial (Handbook 10.2).",
    assignments: "Focus on the Learner: resubmission owed. Language Related Tasks: not yet submitted -- submit before TP7.",
    other: "Attendance below the expected level -- discussed.",
    matrix: { "4h": "N", "5f": "N", "5j": "N", "2a": "N" },
  },
  {
    name: "Ines Marchetti",
    time: "15:15",
    overall: "not_to_standard",
    letter: true,
    acknowledges: false,
    candidateSigns: true,
    notes:
      "Not to standard entering the final third: TP4 and TP6 were below the standard, both on unclear, unchecked instructions and aims not reached for most learners; TP5 met it. Written work adds to the risk: Focus on the Learner failed after resubmission, so no further assignment can be failed. Action points: script and check every instruction (ICQs, not 'ok?'); stage the lesson to the aim and stop when the aim is reached; Language Skills Related Tasks due Monday -- book a consultation before submitting. A Fail letter follows this tutorial (Handbook 10.2).",
    assignments: "Focus on the Learner: Fail on resubmission (warning letter issued). Language Related Tasks: passed. Skills: due Monday 14 September.",
    other: null,
    matrix: { "5f": "N", "4h": "N", "5d": "N" },
  },
  {
    name: "Priya Sharma",
    time: "16:15",
    overall: "above_standard",
    letter: false,
    acknowledges: false,
    candidateSigns: true,
    notes:
      "Above standard and on course for a higher grade. This tutorial makes the criteria for Pass A explicit (Handbook 10.2, footnote 2): consistency across all criteria in TP7 and TP8, independence in planning, and a text-based lesson at the new level. TP5 was below standard on timing -- one more like it would rule Pass A out.",
    assignments: "All submitted work passed at first submission.",
    other: null,
    matrix: { "4a": "S+", "4i": "S+", "2c": "S+", "5i": "S+", "4c": "S+" },
  },
];

const gb = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function seedStage3Demo(supabase, ctx) {
  const { courseId, stage3Date, traineeIdByName, groupByName, tutorIdByGroup, tutorSignatureByGroup, tutorNameByGroup, course, center } = ctx;
  const at = (date, hhmm) => `${date}T${hhmm}:00+03:00`;
  const dayBefore = (iso, n) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };

  // The ported day-15 slots, by time -- one per invited candidate.
  const { data: slots } = await supabase
    .from("course_timetable_events")
    .select("id, event_time, title")
    .eq("course_id", courseId)
    .eq("event_date", stage3Date)
    .ilike("title", "Stage 3 tutorial%");
  const slotByTime = new Map((slots ?? []).map((s) => [s.event_time.slice(0, 5), s]));

  let letters = 0;
  for (const c of CANDIDATES) {
    const traineeId = traineeIdByName[c.name];
    const group = groupByName[c.name];
    const tutorId = tutorIdByGroup[group];
    const slot = slotByTime.get(c.time);
    if (!traineeId || !slot) throw new Error(`stage3-demo: missing ${c.name} or the ${c.time} slot on ${stage3Date}`);

    // 1. The slot becomes this candidate's invite, confirmed the day before.
    await supabase
      .from("course_timetable_events")
      .update({ title: `Stage 3 tutorial — ${c.name}`, tag: "stage3_tutorial", type: "milestone", detail: null, created_by: tutorId })
      .eq("id", slot.id);
    const { data: existing } = await supabase
      .from("individual_tutorial_invites")
      .select("id")
      .eq("course_id", courseId)
      .eq("trainee_id", traineeId)
      .eq("stage", "stage3")
      .maybeSingle();
    const invite = { course_id: courseId, trainee_id: traineeId, stage: "stage3", timetable_event_id: slot.id, confirmed_at: at(dayBefore(stage3Date, 1), "18:20"), created_by: tutorId };
    if (existing) await supabase.from("individual_tutorial_invites").update(invite).eq("id", existing.id);
    else {
      const { error } = await supabase.from("individual_tutorial_invites").insert(invite);
      if (error) throw error;
    }

    // 2. The record: tutorial given, whole record completed, both signatures
    //    where the candidate has signed.
    const finalizedAt = at(stage3Date, c.time === "14:15" ? "15:05" : c.time === "15:15" ? "16:05" : "17:05");
    const { error: rErr } = await supabase
      .from("celta5_records")
      .update({
        stage3_tutorial_required: true,
        stage3_tutorial_given: true,
        stage3_hours_taught: 4.5,
        stage3_tutor_overall: c.overall,
        stage3_tutor_notes: c.notes,
        stage3_tutor_written_assignments_notes: c.assignments,
        stage3_tutor_other_notes: c.other,
        stage3_finalized_at: finalizedAt,
        stage3_tutor_signature_name: tutorSignatureByGroup[group],
        stage3_candidate_signed_at: c.candidateSigns ? at(stage3Date, "20:30") : null,
        stage3_candidate_signature_name: c.candidateSigns ? c.name : null,
      })
      .eq("trainee_id", traineeId);
    if (rErr) throw rErr;

    // 3. The grid's Stage 3 column: Stage 2's ratings carried forward, with
    //    the story's changes.
    const { data: rows } = await supabase.from("celta5_matrix").select("id, criteria_code, tutor_status_stage2").eq("trainee_id", traineeId);
    for (const row of rows ?? []) {
      const value = c.matrix[row.criteria_code] ?? (row.tutor_status_stage2 === "N" && c.overall !== "not_to_standard" ? "S" : row.tutor_status_stage2 ?? "S");
      await supabase.from("celta5_matrix").update({ tutor_status_stage3: value }).eq("id", row.id);
    }

    // 4. The fail letter, shaped as buildFailRiskDraft shapes it, so the
    //    candidate's letter page and the PDF render it.
    if (c.letter) {
      const { data: already } = await supabase.from("formal_letters").select("id").eq("trainee_id", traineeId).eq("letter_type", "fail_risk").maybeSingle();
      if (!already) {
        const tutorName = tutorNameByGroup[group];
        const mctName = tutorNameByGroup.B; // Jordan Blake is the MCT
        const mctIsIssuer = tutorName === mctName;
        const issuedDate = gb(stage3Date);
        const actionPoints = c.notes.split(/\.\s+/).filter((l) => /^Action points/i.test(l) || /^Focus on the Learner/i.test(l) || /^Language Skills/i.test(l)).map((l) => l.replace(/^Action points[^:]*:\s*/i, "").trim());
        const snapshot = {
          centerName: center.name,
          centerSubtitle: `Cambridge CELTA centre · ${center.center_number}`,
          centerLogoUrl: null,
          kicker: "Formal notice · potential fail",
          docTitle: "Notice of a potential Fail outcome",
          dateLabel: issuedDate,
          dayLine: null,
          facts: [
            { label: "Candidate", value: c.name },
            { label: "Course", value: `${course.name} (${gb(course.start_date)} – ${gb(course.end_date)})` },
            { label: "Main tutor", value: mctName },
            { label: "Lessons left", value: "TP7 and TP8" },
          ],
          body: [
            `Dear ${c.name.split(" ")[0]},`,
            "Following your Stage 3 tutorial, we are writing to make clear that on your current progress you are at risk of a Fail outcome on this course. This letter is not a decision. It is a formal notice, given while you still have assessed lessons to teach, so that you have the opportunity and the information to change the outcome.",
            "Your tutors have identified the following action points in your CELTA 5 record. They are the areas your remaining lessons will be judged against.",
          ],
          list: { title: "Action points from your CELTA 5, Stage 3 record", items: actionPoints.length > 0 ? actionPoints : [c.notes] },
          closing: "Your remaining lessons are TP7 and TP8. Please come and talk to your tutor before the first of them -- the slots are in the timetable, and we would rather you used one than not.",
          signatures: mctIsIssuer
            ? [
                { label: "Main course tutor", value: `${tutorName} · ${issuedDate}`, filled: true },
                { label: "Received by candidate", value: c.acknowledges ? `${c.name} · ${issuedDate}` : "Awaiting acknowledgement", filled: c.acknowledges },
              ]
            : [
                { label: "Course tutor", value: `${tutorName} · ${issuedDate}`, filled: true },
                { label: "Main course tutor", value: `${mctName} · ${issuedDate}`, filled: true },
                { label: "Received by candidate", value: c.acknowledges ? `${c.name} · ${issuedDate}` : "Awaiting acknowledgement", filled: c.acknowledges },
              ],
          filedNote: `Filed in CELTA 5 Section A · visible to the assessor · exported with the course at close-out. This is ${center.name}'s document; Connect produced it and does not appear on it.`,
        };
        const { error: lErr } = await supabase.from("formal_letters").insert({
          course_id: courseId,
          trainee_id: traineeId,
          letter_type: "fail_risk",
          snapshot,
          issued_by: tutorId,
          issued_at: at(stage3Date, "18:00"),
          acknowledged_at: c.acknowledges ? at(stage3Date, "19:10") : null,
          candidate_signature_name: c.acknowledges ? c.name : null,
        });
        if (lErr) throw lErr;
        letters += 1;
      }
    }
  }
  return { candidates: CANDIDATES.length, letters };
}
