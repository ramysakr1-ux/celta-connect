import "server-only";
import { PDFDocument } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessTokenFromRefreshToken } from "@/lib/google/oauth";
import { createDriveFolder, uploadFileToDrive } from "@/lib/google/drive";
import { computeStrengthsAndActionPoints } from "@/lib/celta-criteria";
import { computeSignatureLedger, isBookletExportReady } from "@/lib/celta5-signatures";
import { computeAssessedTpStats } from "@/lib/course-progress";
import { mapTpFeedbackToGlyphRow } from "@/lib/tp-grades";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { ASSIGNMENT_CRITERIA } from "@/lib/assignment-criteria";
import { renderCelta5BookletBuffer } from "@/lib/celta5-booklet-pdf/document";
import { renderFinalReportBuffer } from "@/lib/final-report-pdf/document";
import { renderAssignmentCoverSheetBuffer } from "@/lib/assignment-cover-sheet-pdf/document";
import { renderTpPdfBuffer } from "@/lib/tp-pdf/document";
import { renderTutorListBuffer } from "./tutor-list-pdf";
import { renderAttendanceRegisterBuffer } from "./attendance-register-pdf";
import { renderTimetableAsTaughtBuffer } from "./timetable-pdf";
import { renderGradesReportBuffer, type GradesReportCandidate } from "./grades-report-pdf";
import { renderObservationsLogBuffer } from "./observations-log-pdf";
import { joinLinkSender } from "@/lib/resend/client";
import { sendApplicantEmail } from "@/lib/admissions-email";
import type { CriteriaRating, Database } from "@/lib/supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function safeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-").trim();
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function uploadCsv(accessToken: string, parentId: string, filename: string, csv: string): Promise<void> {
  await uploadFileToDrive(accessToken, {
    name: filename,
    parentId,
    mimeType: "text/csv",
    bytes: Buffer.from(csv, "utf-8"),
  });
}

async function uploadPdf(
  accessToken: string,
  parentId: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  await uploadFileToDrive(accessToken, {
    name: filename,
    parentId,
    mimeType: "application/pdf",
    bytes: buffer,
  });
}

// Same TP-materials-merge step as src/app/api/tp-plans/[planId]/pdf/route.ts
// -- the archival copy should carry the trainee's own attached materials
// too, not just the generated text record.
async function buildTpRecordWithMaterials(
  admin: Admin,
  base: Buffer,
  tpPlanId: string
): Promise<Buffer> {
  const { data: materials } = await admin
    .from("tp_materials")
    .select("*")
    .eq("tp_plan_id", tpPlanId)
    .order("created_at");

  const merged = await PDFDocument.load(base);
  for (const material of materials ?? []) {
    if (!material.storage_path) continue;
    const { data: fileBlob } = await admin.storage.from("tp-materials").download(material.storage_path);
    if (!fileBlob) continue;
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());

    if (material.file_type === "pdf") {
      const materialDoc = await PDFDocument.load(bytes).catch(() => null);
      if (!materialDoc) continue;
      const pages = await merged.copyPages(materialDoc, materialDoc.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    } else if (material.file_type === "image") {
      const isPng = (material.file_name ?? "").toLowerCase().endsWith(".png");
      const image = await (isPng ? merged.embedPng(bytes) : merged.embedJpg(bytes)).catch(() => null);
      if (!image) continue;
      const page = merged.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
  }
  return Buffer.from(await merged.save());
}

function provisionalLabel(record: Database["public"]["Tables"]["celta5_records"]["Row"] | undefined): string {
  if (!record?.provisional_grade) return "Not set";
  return record.provisional_grade_upper ? `${record.provisional_grade} / ${record.provisional_grade_upper}` : record.provisional_grade;
}

// "After a successful push, an automated message asks the centre to confirm
// receipt with a digital signature + timestamp." Kept to the spec's stated
// tone -- a warm confirmation, not a legal demand -- and sent to every
// admin at the centre, since there's no separate "centre director" role in
// this app to target instead.
async function sendReceiptRequestEmail(input: {
  admin: Admin;
  centerId: string;
  centerName: string;
  courseId: string;
  courseName: string;
  driveFolderUrl: string;
}): Promise<void> {
  const { admin, centerId, centerName, courseId, courseName, driveFolderUrl } = input;
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) return;

  const { data: admins } = await admin.from("profiles").select("email").eq("center_id", centerId).eq("role", "admin");
  if (!admins || admins.length === 0) return;

  // for-claude-code-email-delivery-tracking.md -- was one raw resend.
  // emails.send() call to all admins at once, untracked. Routed through
  // sendApplicantEmail per-admin instead of widening its `to` param to
  // accept an array -- gives per-recipient delivery/bounce tracking (which
  // admin's address actually bounced) rather than one opaque batched send,
  // and doesn't touch a function nineteen+ other callers already depend on.
  const html = `
      <p>${courseName} has been exported to your centre's Google Drive.</p>
      <p><a href="${driveFolderUrl}">Open the folder</a> and have a look whenever suits.</p>
      <p>Once you're happy everything's there, confirm receipt here so we can start the usual
      week-long grace hold before the working copy in Connect is cleared:</p>
      <p><a href="${siteUrl}/dashboard/admin/courses/${courseId}">Confirm receipt</a></p>
    `;
  for (const a of admins) {
    await sendApplicantEmail({
      centerName,
      centerAdmissionsEmail: null,
      to: a.email,
      subject: `${courseName} is packed up and ready in your Drive`,
      html,
      centerId,
      applicantId: null,
      type: "close_out_receipt",
      from: joinLinkSender(centerName),
    });
  }
}

export async function exportCourseToDrive(courseId: string, exportedBy: string): Promise<void> {
  const admin = createAdminClient();

  const { data: closeOut } = await admin.from("course_close_outs").select("*").eq("course_id", courseId).single();
  if (!closeOut) throw new Error("Close-out record not found. Run verification first.");

  await admin.from("course_close_outs").update({ status: "exporting", updated_at: new Date().toISOString() }).eq("course_id", courseId);

  try {
    const [{ data: course }, { data: connection }] = await Promise.all([
      admin.from("courses").select("*").eq("id", courseId).single(),
      admin.from("center_google_connections").select("refresh_token").eq("center_id", closeOut.center_id).maybeSingle(),
    ]);
    if (!course) throw new Error("Course not found.");
    if (!connection) throw new Error("This centre hasn't connected Google Drive yet -- connect it in Settings first.");

    const { data: center } = await admin.from("centers").select("name, logo_url").eq("id", closeOut.center_id).single();
    const accessToken = await getAccessTokenFromRefreshToken(connection.refresh_token);

    // "Folder shape (locked): top folder = course number + course dates."
    const topFolder = await createDriveFolder(accessToken, `${course.name} (${formatDate(course.start_date)}-${formatDate(course.end_date)})`);

    const { data: trainees } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("course_id", courseId)
      .eq("role", "trainee")
      .order("full_name");
    const candidates = trainees ?? [];
    const traineeIds = candidates.map((t) => t.id);

    const { data: trainers } = await admin
      .from("profiles")
      .select("full_name, tutor_role")
      .eq("course_id", courseId)
      .eq("role", "trainer")
      .order("full_name");

    // ---- Course-level documents, top folder ----
    await uploadPdf(
      accessToken,
      topFolder.id,
      "Tutor list.pdf",
      await renderTutorListBuffer({
        courseName: course.name,
        centerName: center?.name ?? "",
        centerLogoUrl: center?.logo_url ?? null,
        tutors: (trainers ?? []).map((t) => ({ name: t.full_name, tutorRole: t.tutor_role })),
      })
    );

    // "Application files -- application forms and completed selection
    // tasks for both rejected and accepted applicants." build-spec.md /
    // Appeals.dc.html: these are first-class system records, not an
    // upload, and the assessor pack (src/app/assessor/pack.pdf/route.ts)
    // now reads the same table -- this was the other place spec'd to
    // include them that didn't yet. A centre with no rejections on file
    // looks like one that accepts everybody, which is itself a flag to an
    // assessor, so rejected applicants are never filtered out here.
    const { data: applicants } = await admin
      .from("applicants")
      .select(
        "full_name, email, phone, stage, created_at, rejected_at, rejection_reason, marking_language_awareness, marking_accuracy, marking_organisation, marking_range, marking_substance, task_feedback"
      )
      .eq("intake_course_id", courseId)
      .order("created_at");
    if (applicants && applicants.length > 0) {
      const header = [
        "Name",
        "Email",
        "Phone",
        "Stage",
        "Applied",
        "Rejected",
        "Rejection reason",
        "Language awareness",
        "Accuracy",
        "Organisation",
        "Range",
        "Substance",
        "Task feedback",
      ];
      const rows = applicants.map((a) =>
        [
          a.full_name,
          a.email,
          a.phone,
          a.stage,
          a.created_at?.slice(0, 10),
          a.rejected_at?.slice(0, 10) ?? "",
          a.rejection_reason ?? "",
          a.marking_language_awareness ?? "",
          a.marking_accuracy ?? "",
          a.marking_organisation ?? "",
          a.marking_range ?? "",
          a.marking_substance ?? "",
          a.task_feedback ?? "",
        ]
          .map(csvCell)
          .join(",")
      );
      await uploadCsv(accessToken, topFolder.id, "Applicants (including rejected).csv", [header.join(","), ...rows].join("\r\n"));
    }

    const { data: timetableEvents } = await admin
      .from("course_timetable_events")
      .select("event_date, event_time, type, title")
      .eq("course_id", courseId);
    await uploadPdf(
      accessToken,
      topFolder.id,
      "Timetable as taught.pdf",
      await renderTimetableAsTaughtBuffer({
        courseName: course.name,
        centerName: center?.name ?? "",
        centerLogoUrl: center?.logo_url ?? null,
        events: timetableEvents ?? [],
      })
    );

    const { data: volunteers } = await admin
      .from("volunteer_students")
      .select("id, name, level")
      .eq("course_id", courseId)
      .is("removed_at", null)
      .order("name");
    const { data: tpEvents } = await admin
      .from("course_timetable_events")
      .select("id, event_date")
      .eq("course_id", courseId)
      .eq("type", "tp")
      .order("event_date");
    const volunteerIds = (volunteers ?? []).map((v) => v.id);
    const { data: attendanceRows } =
      volunteerIds.length > 0
        ? await admin.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
        : { data: [] };
    await uploadPdf(
      accessToken,
      topFolder.id,
      "Volunteer attendance register.pdf",
      await renderAttendanceRegisterBuffer({
        courseName: course.name,
        centerName: center?.name ?? "",
        centerLogoUrl: center?.logo_url ?? null,
        events: tpEvents ?? [],
        volunteers: volunteers ?? [],
        attendance: attendanceRows ?? [],
      })
    );

    // Grades report -- cohort sheet + per-candidate strengths/action points,
    // same computation grades-report/page.tsx uses on screen.
    const [{ data: celta5Records }, { data: matrixRows }, { data: tpFeedbackRows }, { data: assignments }] =
      traineeIds.length > 0
        ? await Promise.all([
            admin.from("celta5_records").select("*").eq("course_id", courseId),
            admin
              .from("celta5_matrix")
              .select("trainee_id, criteria_code, tutor_status_stage2, tutor_status_stage3")
              .eq("course_id", courseId),
            admin.from("tp_feedback").select("trainee_id, tp_number, grade, submitted_at").in("trainee_id", traineeIds),
            admin.from("assignments").select("*").in("trainee_id", traineeIds),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

    const recordByTrainee = new Map((celta5Records ?? []).map((r) => [r.trainee_id, r]));
    const matrixByTrainee = new Map<string, Record<string, CriteriaRating | null>>();
    for (const row of matrixRows ?? []) {
      const ratings = matrixByTrainee.get(row.trainee_id) ?? {};
      ratings[row.criteria_code] = row.tutor_status_stage3 ?? row.tutor_status_stage2;
      matrixByTrainee.set(row.trainee_id, ratings);
    }

    const gradesReportCandidates: GradesReportCandidate[] = candidates.map((trainee) => {
      const record = recordByTrainee.get(trainee.id);
      const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);
      const traineeFeedback = (tpFeedbackRows ?? []).filter((f) => f.trainee_id === trainee.id);
      const ratings = matrixByTrainee.get(trainee.id) ?? {};
      const { planningStrengths, planningActionPoints, teachingStrengths, teachingActionPoints } = computeStrengthsAndActionPoints(ratings);

      let outstanding = "";
      if (!record) {
        outstanding = "No CELTA 5 record";
      } else if (record.stage3_required && !record.stage3_finalized_at) {
        outstanding = "Stage 3 record open";
      } else {
        const unresolved = traineeAssignments.find((a) => {
          const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
          const status = isResubmissionRound ? a.resubmission_status : a.first_status;
          return status !== "approved";
        });
        if (unresolved) {
          outstanding = `${ASSIGNMENT_INFO[unresolved.assignment_type]?.title ?? unresolved.assignment_type} unresolved`;
        } else {
          const ledger = computeSignatureLedger(record, traineeAssignments);
          if (!isBookletExportReady(ledger)) {
            const outstandingCount = ledger.filter((r) => r.state !== "signed").length;
            outstanding = `${outstandingCount} signature${outstandingCount === 1 ? "" : "s"} outstanding`;
          }
        }
      }

      return {
        name: trainee.full_name,
        tpGlyphs: mapTpFeedbackToGlyphRow(traineeFeedback),
        provisionalLabel: provisionalLabel(record),
        recommendedGrade: record?.final_recommended_grade ?? null,
        outstanding,
        planningStrengths,
        planningActionPoints,
        teachingStrengths,
        teachingActionPoints,
      };
    });

    await uploadPdf(
      accessToken,
      topFolder.id,
      "Grades report.pdf",
      await renderGradesReportBuffer({
        courseName: course.name,
        centerName: center?.name ?? "",
        centerLogoUrl: center?.logo_url ?? null,
        candidates: gradesReportCandidates,
      })
    );

    // ---- Per-candidate folders ----
    for (const trainee of candidates) {
      const traineeFolder = await createDriveFolder(accessToken, safeName(trainee.full_name), topFolder.id);

      const record = recordByTrainee.get(trainee.id) ?? null;
      const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);

      // CELTA 5 booklet
      if (record) {
        const ledger = computeSignatureLedger(record, traineeAssignments);
        if (isBookletExportReady(ledger)) {
          const { data: matrix } = await admin.from("celta5_matrix").select("*").eq("trainee_id", trainee.id);
          const matrixByCode: Record<
            string,
            { candidateStatus: CriteriaRating | null; tutorStatusStage2: CriteriaRating | null; tutorStatusStage3: CriteriaRating | null }
          > = {};
          for (const m of matrix ?? []) {
            matrixByCode[m.criteria_code] = {
              candidateStatus: m.candidate_status,
              tutorStatusStage2: m.tutor_status_stage2,
              tutorStatusStage3: m.tutor_status_stage3,
            };
          }
          const { data: observationsForStats } = await admin.from("observations").select("length_minutes, filmed").eq("trainee_id", trainee.id);
          const { data: planAssignmentsForBooklet } = await admin
            .from("plan_assignments")
            .select("tp_point_id, taught_at")
            .eq("trainee_id", trainee.id);
          const taughtAssignments = (planAssignmentsForBooklet ?? []).filter((p) => p.taught_at);
          const liveMinutes = (observationsForStats ?? []).filter((o) => !o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
          const filmedMinutes = (observationsForStats ?? []).filter((o) => o.filmed).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);

          const bookletTpPointIds = [...new Set(taughtAssignments.map((p) => p.tp_point_id).filter((id): id is string => !!id))];
          const { data: bookletTpPoints } =
            bookletTpPointIds.length > 0 ? await admin.from("tp_points").select("id, tp_coursebook_id").in("id", bookletTpPointIds) : { data: [] };
          const bookletCoursebookIds = [...new Set((bookletTpPoints ?? []).map((p) => p.tp_coursebook_id))];
          const { data: bookletCoursebooks } =
            bookletCoursebookIds.length > 0 ? await admin.from("tp_coursebooks").select("id, level").in("id", bookletCoursebookIds) : { data: [] };
          const assessedTp = computeAssessedTpStats({
            taughtAssignments,
            tpPointCoursebookById: new Map((bookletTpPoints ?? []).map((p) => [p.id, p.tp_coursebook_id])),
            coursebookLevelById: new Map((bookletCoursebooks ?? []).map((c) => [c.id, c.level])),
          });

          const buffer = await renderCelta5BookletBuffer({
            traineeName: trainee.full_name,
            courseName: course.name,
            centerName: center?.name ?? "",
            centerLogoUrl: center?.logo_url ?? null,
            courseStartDate: course.start_date,
            courseEndDate: course.end_date,
            tutorNames: (trainers ?? []).map((t) => t.full_name),
            matrixByCode,
            record,
            attendance: { hoursAttended: record.hours_attended ?? 0, totalHours: course.total_hours },
            observations: { liveHours: liveMinutes / 60, filmedHours: filmedMinutes / 60 },
            assessedTp,
            assignments: traineeAssignments.map((a) => {
              const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
              const status = isResubmissionRound ? a.resubmission_status : a.first_status;
              return {
                title: ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type,
                status,
                grade: a.final_grade,
              };
            }),
            ledger,
          });
          await uploadPdf(accessToken, traineeFolder.id, `CELTA5 - ${safeName(trainee.full_name)}.pdf`, buffer);
        }

        // Final report, staff copy -- gated the same as the staff download
        // (trainer_signoff_final_at), not the separate trainee-release gate.
        if (
          record.trainer_signoff_final_at &&
          record.final_recommended_grade &&
          !["Withdrawn", "Extension", "Deferred"].includes(record.final_recommended_grade)
        ) {
          const buffer = await renderFinalReportBuffer({
            traineeName: trainee.full_name,
            courseName: course.name,
            centerName: center?.name ?? "",
            centerLogoUrl: center?.logo_url ?? null,
            courseStartDate: course.start_date,
            courseEndDate: course.end_date,
            totalHours: course.total_hours,
            finalGrade: record.final_recommended_grade,
            teachingGrade: record.final_teaching_grade,
            assignmentsGrade: record.final_assignments_grade,
            overallComment: record.overall_notes,
            signatories: (trainers ?? []).map((t) => ({ name: t.full_name, role: "CELTA Course Tutor" })),
          });
          await uploadPdf(accessToken, traineeFolder.id, `Final report - ${safeName(trainee.full_name)}.pdf`, buffer);
        }
      }

      // Assignment cover sheets
      for (const assignment of traineeAssignments) {
        if (assignment.first_status !== "approved" && assignment.first_status !== "resubmission_required") continue;

        const [{ data: template }, { data: responses }, { data: markers }] = await Promise.all([
          admin
            .from("assignment_templates")
            .select("sections")
            .eq("center_id", closeOut.center_id)
            .eq("assignment_type", assignment.assignment_type)
            .not("published_at", "is", null)
            .maybeSingle(),
          admin.from("assignment_section_responses").select("*").eq("assignment_id", assignment.id),
          admin
            .from("profiles")
            .select("id, full_name")
            .in("id", [assignment.marker_id, assignment.second_marker_id].filter((id): id is string => Boolean(id))),
        ]);

        const markerName = new Map((markers ?? []).map((m) => [m.id, m.full_name]));
        const hasResubmission = assignment.resubmission_status !== "not_submitted";
        const outcome: "pass" | "resubmission_required" | "pass_on_resubmission" | "fail_on_resubmission" =
          assignment.resubmission_status === "approved"
            ? assignment.resubmission_outcome === "fail"
              ? "fail_on_resubmission"
              : "pass_on_resubmission"
            : assignment.first_status === "resubmission_required"
              ? "resubmission_required"
              : "pass";

        const sections = (template?.sections ?? []) as { key: string; title: string }[];
        const responseByKey = new Map((responses ?? []).map((r) => [r.section_key, r]));
        const criteria = ASSIGNMENT_CRITERIA[assignment.assignment_type];
        const firstMarks = assignment.first_criteria_marks as Record<string, boolean>;
        const resubMarks = assignment.resubmission_criteria_marks as Record<string, boolean>;

        const buffer = await renderAssignmentCoverSheetBuffer({
          candidateName: trainee.full_name,
          centerName: center?.name ?? "",
          centerLogoUrl: center?.logo_url ?? null,
          courseName: course.name,
          courseDates: `${course.start_date} - ${course.end_date}`,
          assignmentTitle: ASSIGNMENT_INFO[assignment.assignment_type].title,
          firstSubmittedAt: assignment.first_submitted_at,
          resubmittedAt: assignment.resubmission_submitted_at,
          firstMarkerName: (assignment.marker_id && markerName.get(assignment.marker_id)) || "-",
          secondMarkerName: assignment.second_marker_id ? (markerName.get(assignment.second_marker_id) ?? null) : null,
          secondMarkerDate: assignment.second_marker_recorded_at,
          criteria: criteria.map((c) => ({ criterion: c, first: firstMarks?.[c.key], second: hasResubmission ? resubMarks?.[c.key] : undefined })),
          outcome,
          hasResubmission,
          sectionComments: sections.map((sec) => ({
            title: sec.title,
            firstComment: responseByKey.get(sec.key)?.first_comments ?? null,
            resubmissionComment: responseByKey.get(sec.key)?.resubmission_comments ?? null,
          })),
          sections: sections.map((sec) => ({
            title: sec.title,
            firstResponse: responseByKey.get(sec.key)?.first_response ?? null,
            resubmissionResponse: responseByKey.get(sec.key)?.resubmission_response ?? null,
          })),
        });
        await uploadPdf(
          accessToken,
          traineeFolder.id,
          `Cover sheet - ${safeName(ASSIGNMENT_INFO[assignment.assignment_type].title)}.pdf`,
          buffer
        );
      }

      // TP records -- one per taught TP with a submitted plan/self-eval/feedback
      const { data: taughtTps } = await admin
        .from("plan_assignments")
        .select("tp_number")
        .eq("course_id", courseId)
        .eq("trainee_id", trainee.id)
        .not("taught_at", "is", null);

      for (const { tp_number } of taughtTps ?? []) {
        const { data: plan } = await admin
          .from("tp_plans")
          .select("*")
          .eq("course_id", courseId)
          .eq("trainee_id", trainee.id)
          .eq("tp_number", tp_number)
          .maybeSingle();
        if (!plan?.submitted_at) continue;

        const [{ data: languageAnalysis }, { data: selfEvaluation }, { data: feedback }] = await Promise.all([
          admin.from("tp_language_analyses").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
          admin.from("tp_self_evaluations").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
          admin.from("tp_feedback").select("*").eq("tp_plan_id", plan.id).maybeSingle(),
        ]);
        if (!selfEvaluation?.submitted_at || !feedback?.submitted_at) continue;

        const base = await renderTpPdfBuffer({
          traineeName: trainee.full_name,
          tpNumber: plan.tp_number,
          plan,
          languageAnalysis: languageAnalysis ?? null,
          selfEvaluation,
          feedback,
        });
        const withMaterials = await buildTpRecordWithMaterials(admin, base, plan.id);
        await uploadPdf(accessToken, traineeFolder.id, `TP${tp_number} record - ${safeName(trainee.full_name)}.pdf`, withMaterials);
      }

      // Observations log
      const { data: observations } = await admin
        .from("observations")
        .select("observation_date, length_minutes, level, learners_present, lesson_focus, filmed")
        .eq("course_id", courseId)
        .eq("trainee_id", trainee.id)
        .order("observation_date");
      await uploadPdf(
        accessToken,
        traineeFolder.id,
        `Observations log - ${safeName(trainee.full_name)}.pdf`,
        await renderObservationsLogBuffer({
          traineeName: trainee.full_name,
          courseName: course.name,
          observations: observations ?? [],
        })
      );
    }

    await admin
      .from("course_close_outs")
      .update({
        status: "awaiting_receipt",
        drive_folder_id: topFolder.id,
        drive_folder_url: topFolder.webViewLink,
        exported_at: new Date().toISOString(),
        exported_by: exportedBy,
        export_error: null,
        receipt_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("course_id", courseId);

    await sendReceiptRequestEmail({
      admin,
      centerId: closeOut.center_id,
      centerName: center?.name ?? "",
      courseId,
      courseName: course.name,
      driveFolderUrl: topFolder.webViewLink,
    });
  } catch (err) {
    await admin
      .from("course_close_outs")
      .update({
        status: "export_failed",
        export_error: err instanceof Error ? err.message : "Unknown error",
        updated_at: new Date().toISOString(),
      })
      .eq("course_id", courseId);
    throw err;
  }
}

// for-claude-code-centre-settings.md: "Delete this centre... anything
// covered by Cambridge's own retention rules is kept regardless of this
// action." A centre hard-delete has no per-course grace period or human
// review the way normal close-out does, so this is the backstop that makes
// that sentence true: called once per course before centreHardDelete's
// account-removal loop starts, for every course that has never had a
// successful export. Skips the human verification step deliberately --
// the point here is "don't lose the record," not "certify the course is
// portfolio-complete" -- and reuses the exact same Drive write path close-
// out already uses, so the surviving copy is the real close-out export,
// not a second, different archive format.
export async function ensureCourseArchived(courseId: string, centerId: string, exportedBy: string): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("course_close_outs")
    .select("id, drive_folder_url")
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing?.drive_folder_url) return; // Already archived -- nothing to do.

  if (existing) {
    await admin.from("course_close_outs").update({ status: "verifying", updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await admin.from("course_close_outs").insert({ course_id: courseId, center_id: centerId, status: "verifying", created_by: exportedBy });
  }

  await exportCourseToDrive(courseId, exportedBy);
}
