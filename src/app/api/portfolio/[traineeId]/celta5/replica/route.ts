import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSignatureLedger, isBookletExportReady } from "@/lib/celta5-signatures";
import { renderCelta5ReplicaBuffer } from "@/lib/celta5-replica-pdf";
import type { CriteriaMarks } from "@/lib/celta5-replica-pdf/pages/criteria-grid";
import type { AssignmentTypeValue } from "@/lib/celta5-replica-pdf/pages/written-assignments";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// The real Cambridge CELTA 5 replica -- see src/lib/celta5-replica-pdf. Same
// three-way viewer resolution and signature-ledger readiness gate as the
// existing celta5/booklet route (Connect's own "digital original" design,
// which stays as its own separate thing); this is the document a candidate
// actually submits to Cambridge, generated at course close-out.
export async function GET(_request: Request, { params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;

  if (!viewer && !assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (viewer && !isStaff) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const admin = createAdminClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("full_name, course_id, center_id")
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee || !trainee.course_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (assessorCourseId && trainee.course_id !== assessorCourseId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const [
    { data: course },
    { data: center },
    { data: matrix },
    { data: record },
    { data: assignments },
    { data: tutors },
    { data: absences },
    { data: observations },
    { data: tpLessons },
  ] = await Promise.all([
    supabase.from("courses").select("course_code, start_date, end_date, total_hours").eq("id", trainee.course_id).maybeSingle(),
    supabase.from("centers").select("name, center_number").eq("id", trainee.center_id).maybeSingle(),
    admin.from("celta5_matrix").select("*").eq("trainee_id", traineeId),
    admin.from("celta5_records").select("*").eq("trainee_id", traineeId).maybeSingle(),
    admin.from("assignments").select("*").eq("trainee_id", traineeId),
    admin.from("profiles").select("full_name").eq("course_id", trainee.course_id).eq("role", "trainer").order("full_name"),
    admin.from("attendance_absences").select("*").eq("trainee_id", traineeId).order("session_date"),
    admin.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
    admin.from("tp_lessons").select("*").eq("trainee_id", traineeId).order("lesson_date"),
  ]);

  if (!record) {
    return NextResponse.json({ error: "No CELTA 5 record found." }, { status: 404 });
  }
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const ledger = computeSignatureLedger(record, assignments ?? []);
  if (!isBookletExportReady(ledger)) {
    return NextResponse.json({ error: "This booklet can't be exported yet -- some signatures are still outstanding." }, { status: 409 });
  }

  const trainerIds = [...new Set((tpLessons ?? []).map((l) => l.trainer_id).filter((id): id is string => !!id))];
  const { data: tpTrainers } = trainerIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", trainerIds) : { data: [] };
  const trainerNameById = new Map((tpTrainers ?? []).map((t) => [t.id, t.full_name]));

  const candidateStage2Marks: CriteriaMarks = {};
  const tutorStage2Marks: CriteriaMarks = {};
  const tutorStage3Marks: CriteriaMarks = {};
  for (const m of matrix ?? []) {
    candidateStage2Marks[m.criteria_code] = m.candidate_status;
    tutorStage2Marks[m.criteria_code] = m.tutor_status_stage2;
    tutorStage3Marks[m.criteria_code] = m.tutor_status_stage3;
  }

  const buffer = await renderCelta5ReplicaBuffer({
    cover: {
      traineeName: trainee.full_name,
      centerName: center?.name ?? "",
      centerNumber: center?.center_number ?? "",
      courseCode: course.course_code,
      courseDates: `${fmtDate(course.start_date)} - ${fmtDate(course.end_date)}`,
      tutorNames: (tutors ?? []).map((t) => t.full_name),
    },
    attendance: {
      totalCourseHours: course.total_hours,
      totalHoursAttended: record.hours_attended,
      unavoidableAbsences: (absences ?? [])
        .filter((a) => a.category === "unavoidable")
        // Was hardcoded null, so the tutor signature this table asks for
        // never reached the PDF at all. migration 0249 gave it a column of
        // its own; before that it was living in tutor_comment, which is why
        // the fallback reads both.
        .map((a) => ({
          date: a.session_date ? fmtDate(a.session_date) : "",
          sessionMissed: a.session_missed,
          reason: a.reason,
          workMadeUp: a.work_made_up,
          candidateComment: null, // this sub-table has no candidate-comment column
          tutorComment: a.tutor_signature_name ?? a.tutor_comment,
        })),
      otherAbsences: (absences ?? [])
        .filter((a) => a.category === "other")
        .map((a) => ({
          date: a.session_date ? fmtDate(a.session_date) : "",
          sessionMissed: a.session_missed,
          reason: a.reason,
          workMadeUp: a.work_made_up,
          candidateComment: a.candidate_comment,
          // Cambridge prints "Tutor comment/signature" in one cell here.
          tutorComment: [a.tutor_comment, a.tutor_signature_name].filter(Boolean).join(" \u00b7 ") || null,
        })),
    },
    writtenAssignments: {
      assignments: (assignments ?? []).map((a) => {
        const firstPassed = a.first_content_grade === "pass" && a.first_english_grade === "pass";
        const confirmedRound = a.resubmission_status !== "not_submitted" ? a.resubmission_own_work_confirmed : a.first_own_work_confirmed;
        // The name printed here has to be the name the candidate actually
        // signed with, not their profile name: migration 0245 stores the
        // signature per round, and a candidate whose signature_name differs
        // from full_name was being printed as somebody who never signed.
        //
        // Falls back through the round that was actually signed -- the
        // resubmission's signature when there was a resubmission, the first
        // submission's otherwise -- and only then to the profile name, so a
        // record signed before 0245 still prints something true rather than
        // blank.
        const onResubmission = a.resubmission_status !== "not_submitted";
        const signedName = onResubmission
          ? a.resubmission_outcome_signature_name ?? a.first_outcome_signature_name
          : a.first_outcome_signature_name;
        return {
          assignmentType: a.assignment_type as AssignmentTypeValue,
          finalGrade: a.final_grade,
          passedOnResubmission: a.final_grade === "Pass" && !firstPassed,
          candidateSignatureName: signedName ?? (confirmedRound ? trainee.full_name : null),
        };
      }),
    },
    stage1: {
      tutorialGiven: record.stage1_tutorial_given,
      hoursTaught: record.stage1_hours_taught,
      strengths: record.stage1_strengths,
      actionPlan: record.stage1_action_plan,
      candidateSignatureName: record.stage1_candidate_signature_name,
      candidateSignedAt: record.stage1_candidate_signed_at,
      tutorSignatureName: record.stage1_tutor_signature_name,
      tutorSignedAt: record.stage1_completed_at,
    },
    observations: (observations ?? []).map((o) => ({
      date: o.observation_date ? fmtDate(o.observation_date) : "",
      lengthMinutes: o.length_minutes,
      level: o.level,
      learnersPresent: o.learners_present,
      lessonFocus: o.lesson_focus,
    })),
    assessedTp: (tpLessons ?? []).map((l) => ({
      date: l.lesson_date ? fmtDate(l.lesson_date) : "",
      lengthMinutes: l.length_minutes,
      level: l.level,
      learnerCount: l.learner_count,
      lessonFocus: l.lesson_focus,
      tutorAssessment: l.tutor_assessment,
      tutorInitials: l.trainer_id ? initials(trainerNameById.get(l.trainer_id) ?? "") : null,
    })),
    candidateStage2Marks,
    tutorStage2Marks,
    tutorStage3Marks,
    stage2Notes: {
      candidateWrittenAssignmentsNotes: record.stage2_candidate_written_assignments_notes,
      tutorWrittenAssignmentsNotes: record.stage2_tutor_written_assignments_notes,
      candidateOtherNotes: record.stage2_candidate_other_notes,
      tutorOtherNotes: record.stage2_tutor_other_notes,
    },
    stage2Overall: {
      candidateOverall: record.stage2_candidate_overall,
      candidateNotes: record.stage2_candidate_notes,
      tutorOverall: record.stage2_tutor_overall,
      tutorNotes: record.stage2_tutor_notes,
      tutorSignatureName: record.stage2_tutor_signature_name,
      tutorSignedAt: record.stage2_completed_at,
      candidateSignatureName: record.stage2_candidate_signature_name,
      candidateSignedAt: record.trainee_signoff_stage2_at,
    },
    stage3Notes: {
      tutorWrittenAssignmentsNotes: record.stage3_tutor_written_assignments_notes,
      tutorOtherNotes: record.stage3_tutor_other_notes,
    },
    stage3Overall: {
      tutorOverall: record.stage3_tutor_overall,
      tutorNotes: record.stage3_tutor_notes,
      tutorSignatureName: record.stage3_tutor_signature_name,
      tutorSignedAt: record.stage3_finalized_at,
      candidateSignatureName: record.stage3_candidate_signature_name,
      candidateSignedAt: record.stage3_candidate_signed_at,
    },
    finalDeclaration: {
      checklistTp: record.final_checklist_tp,
      checklistObservations: record.final_checklist_observations,
      checklistAssignments: record.final_checklist_assignments,
      checklistOwnWork: record.final_checklist_own_work,
      checklistAllRecords: record.final_checklist_all_records,
      candidateSignatureName: record.final_candidate_signature_name,
      candidateSignedAt: record.trainee_signoff_final_at,
      tutorSignatureName: record.final_tutor_signature_name,
      tutorSignedAt: record.trainer_signoff_final_at,
    },
    confirmations: {
      candidateName: trainee.full_name,
      portfolioConfirmedAt: record.portfolio_terms_confirmed_at,
      portfolioSignatureName: record.portfolio_terms_signature_name,
      appealsConfirmedAt: record.appeals_read_confirmed_at,
      appealsSignatureName: record.appeals_read_signature_name,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CELTA5-${trainee.full_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
