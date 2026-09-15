import "server-only";
import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStrengthsAndActionPoints } from "@/lib/celta-criteria";
import { computeSignatureLedger, isBookletExportReady } from "@/lib/celta5-signatures";
import { computeAssessedTpStats } from "@/lib/course-progress";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { getAssignmentCriteria } from "@/lib/assignment-criteria";
import { renderCelta5BookletBuffer } from "@/lib/celta5-booklet-pdf/document";
import { renderFinalReportBuffer } from "@/lib/final-report-pdf/document";
import { renderFormalLetterBuffer, type FormalLetterInput } from "@/lib/formal-letter-pdf/document";
import { renderAssignmentCoverSheetBuffer } from "@/lib/assignment-cover-sheet-pdf/document";
import { renderTpPdfBuffer } from "@/lib/tp-pdf/document";
import { renderObservationsLogBuffer } from "./observations-log-pdf";
import { buildWithdrawalLetterInput } from "@/lib/letters/withdrawal";
import { formatCalendarDate } from "@/lib/format-date";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import type { CriteriaRating, Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

export function safeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-").trim();
}

const MIME_BY_TYPE: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export interface UnmergedMaterial {
  name: string;
  mimeType: string;
  bytes: Buffer;
}

export async function buildTpRecordWithMaterials(
  admin: Admin,
  base: Buffer,
  tpPlanId: string
): Promise<{ buffer: Buffer; unmerged: UnmergedMaterial[] }> {
  const { data: materials } = await admin
    .from("tp_materials")
    .select("*")
    .eq("tp_plan_id", tpPlanId)
    .order("created_at");

  const merged = await PDFDocument.load(base);
  // A material that cannot be merged is CARRIED, never dropped.
  //
  // The upload form accepts PDF, images, .docx/.doc and .pptx/.ppt
  // (attach-menu.tsx), and this merged only pdf and image -- so a
  // candidate's Word handout or PowerPoint slides were `continue`d straight
  // out of the archive, silently, and the archive is the only copy anyone
  // keeps. The demo course happens to hold only PDFs and one PNG, which is
  // why it never showed (walked 15 Sep 2026).
  //
  // Not converted: there is no LibreOffice or conversion service in this
  // runtime, and a lossy re-render of somebody's worksheet would be worse
  // than the file itself. Drive previews both formats natively, so the
  // original goes in beside the record.
  const unmerged: UnmergedMaterial[] = [];
  for (const material of materials ?? []) {
    if (!material.storage_path) continue;
    const { data: fileBlob } = await admin.storage.from("tp-materials").download(material.storage_path);
    if (!fileBlob) continue;
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());

    if (material.file_type === "pdf") {
      const materialDoc = await PDFDocument.load(bytes).catch(() => null);
      if (materialDoc) {
        const pages = await merged.copyPages(materialDoc, materialDoc.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
        continue;
      }
      // A PDF that will not parse still belongs in the folder.
      unmerged.push({ name: material.file_name ?? "material.pdf", mimeType: "application/pdf", bytes: Buffer.from(bytes) });
      continue;
    }

    if (material.file_type === "image") {
      const isPng = (material.file_name ?? "").toLowerCase().endsWith(".png");
      const image = await (isPng ? merged.embedPng(bytes) : merged.embedJpg(bytes)).catch(() => null);
      if (image) {
        const page = merged.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        continue;
      }
      unmerged.push({
        name: material.file_name ?? "material",
        mimeType: isPng ? "image/png" : "image/jpeg",
        bytes: Buffer.from(bytes),
      });
      continue;
    }

    unmerged.push({
      name: material.file_name ?? "material",
      mimeType: MIME_BY_TYPE[material.file_type ?? ""] ?? "application/octet-stream",
      bytes: Buffer.from(bytes),
    });
  }
  return { buffer: Buffer.from(await merged.save()), unmerged };
}


export interface PortfolioFile {
  name: string;
  mimeType: string;
  bytes: Buffer;
}

/**
 * One candidate's portfolio, as files.
 *
 * Handbook 12.1.1 names what a portfolio consists of -- the CELTA 5, the
 * records of each assessed teaching practice session with plans, materials
 * and feedback, and the four written assignments with their marking. This
 * builds exactly that set, and returns it rather than putting it anywhere,
 * so the same bundle can go to the centre's Drive at close-out and to the
 * candidate as a download.
 *
 * Extracted from exportCourseToDrive 15 Sep 2026 so there is one bundle and
 * not two that drift. Ramy: everything is converted to PDF and imported by
 * the centre into Drive, and Connect keeps nothing afterwards -- which makes
 * it the more important that what the candidate can take is the same thing.
 */
export async function buildCandidatePortfolio(
  admin: Admin,
  ctx: {
    courseId: string;
    course: { name: string; start_date: string; end_date: string; total_hours: number; delivery_mode: Database["public"]["Tables"]["courses"]["Row"]["delivery_mode"] };
    center: { name: string; logo_url: string | null; time_zone: string | null } | null;
    centerId: string;
    tutorNames: string[];
    trainee: { id: string; full_name: string; courseStatus?: string | null };
    record: Database["public"]["Tables"]["celta5_records"]["Row"] | null;
    assignments: Database["public"]["Tables"]["assignments"]["Row"][];
  }
): Promise<PortfolioFile[]> {
  const files: PortfolioFile[] = [];
  const { courseId, course, center, trainee } = ctx;
  const trainers = ctx.tutorNames.map((full_name) => ({ full_name }));
  const recordByTrainee = new Map([[trainee.id, ctx.record]]);
  const assignments = ctx.assignments;
  const closeOut = { center_id: ctx.centerId };

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
    timeZone: center?.time_zone ?? DEFAULT_TIMEZONE,
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
    files.push({ name: `CELTA5 - ${safeName(trainee.full_name)}.pdf`, mimeType: "application/pdf", bytes: buffer });
  }

  // Final report, staff copy -- gated the same as the staff download
  // (trainer_signoff_final_at), not the separate trainee-release gate.
  if (
    record.trainer_signoff_final_at &&
    record.final_recommended_grade &&
    !["Withdrawn", "Extension", "Deferred"].includes(record.final_recommended_grade)
  ) {
    const buffer = await renderFinalReportBuffer({
    timeZone: center?.time_zone ?? DEFAULT_TIMEZONE,
      traineeName: trainee.full_name,
      courseName: course.name,
      centerName: center?.name ?? "",
      centerLogoUrl: center?.logo_url ?? null,
      courseStartDate: course.start_date,
      courseEndDate: course.end_date,
      totalHours: course.total_hours,
      deliveryMode: course.delivery_mode ?? null,
      hoursAttended: record.hours_attended,
      finalGrade: record.final_recommended_grade,
      teachingGrade: record.final_teaching_grade,
      assignmentsGrade: record.final_assignments_grade,
      overallComment: record.overall_notes,
      signatories: (trainers ?? []).map((t) => ({ name: t.full_name, role: "CELTA Course Tutor" })),
    });
    files.push({ name: `Final report - ${safeName(trainee.full_name)}.pdf`, mimeType: "application/pdf", bytes: buffer });
  }
}

// Reference letter -- optional per-candidate (for-claude-code-
// reference-letter.md: "not required for every candidate... a tool
// the centre can use when they choose to"), so only included when one
// was actually issued. Renders the stored snapshot, same reasoning as
// /api/formal-letter/[letterId]/route.ts: a filed written record, not
// regenerated from live data at export time.
// Handbook 12.1.1, Section A, "where appropriate": "a fail warning letter
// from the centre alerting the candidate to the possibility of failure"
// and "candidate letter of withdrawal".
//
// Neither was here. The portfolio carried the REFERENCE letter, which
// 12.1.1 does not list, and left out the two it names -- so the archive was
// missing exactly the letters Cambridge asks a portfolio to contain
// (walked 15 Sep 2026). An assignment warning goes in on the same footing:
// it is a fail warning about written work, issued by the centre for the
// same reason.
const { data: warningLetters } = await admin
  .from("formal_letters")
  .select("letter_type, snapshot, issued_at")
  .eq("trainee_id", trainee.id)
  .in("letter_type", ["fail_risk", "assignment_warning"])
  .order("issued_at");
for (const letter of warningLetters ?? []) {
  const label = letter.letter_type === "fail_risk" ? "Fail warning letter" : "Assignment warning letter";
  files.push({
    name: `${label} - ${safeName(trainee.full_name)}.pdf`,
    mimeType: "application/pdf",
    bytes: await renderFormalLetterBuffer(letter.snapshot as unknown as FormalLetterInput),
  });
}

// The withdrawal letter, for a candidate who withdrew. Built rather than
// stored -- it has no formal_letters row; /api/withdrawal-letter renders it
// from the candidate's own status the same way.
if (ctx.trainee.courseStatus === "withdrawn") {
  const { data: full } = await admin
    .from("profiles")
    .select("course_status_set_at, course_status_set_by, course_status_note, withdrawal_reportable")
    .eq("id", trainee.id)
    .maybeSingle();
  const { data: courseRow } = await admin
    .from("courses")
    .select("entry_form_sent_at, center_id")
    .eq("id", courseId)
    .maybeSingle();
  const { data: issuer } = full?.course_status_set_by
    ? await admin.from("profiles").select("full_name").eq("id", full.course_status_set_by).maybeSingle()
    : { data: null };
  const { data: centreRow } = await admin.from("centers").select("center_number").eq("id", ctx.centerId).maybeSingle();
  const letterInput = await buildWithdrawalLetterInput(admin, {
    traineeId: trainee.id,
    traineeName: trainee.full_name,
    courseId,
    courseName: course.name,
    courseStartDate: course.start_date,
    courseEndDate: course.end_date,
    centerName: center?.name ?? "Your centre",
    centerNumber: centreRow?.center_number ?? null,
    withdrawnAt: full?.course_status_set_at ?? new Date().toISOString(),
    reportable: Boolean(full?.withdrawal_reportable),
    note: full?.course_status_note ?? null,
    entryFormSentAt: courseRow?.entry_form_sent_at ?? null,
    issuedByName: issuer?.full_name ?? center?.name ?? "The centre",
  });
  files.push({
    name: `Withdrawal letter - ${safeName(trainee.full_name)}.pdf`,
    mimeType: "application/pdf",
    bytes: await renderFormalLetterBuffer(letterInput),
  });
}

const { data: referenceLetter } = await admin
  .from("formal_letters")
  .select("snapshot")
  .eq("trainee_id", trainee.id)
  .eq("letter_type", "reference")
  .order("issued_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (referenceLetter) {
  const buffer = await renderFormalLetterBuffer(referenceLetter.snapshot as unknown as FormalLetterInput);
  files.push({ name: `Reference letter - ${safeName(trainee.full_name)}.pdf`, mimeType: "application/pdf", bytes: buffer });
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
  const criteria = await getAssignmentCriteria(admin, closeOut.center_id, assignment.assignment_type);
  const firstMarks = assignment.first_criteria_marks as Record<string, boolean>;
  const resubMarks = assignment.resubmission_criteria_marks as Record<string, boolean>;

  const buffer = await renderAssignmentCoverSheetBuffer({
    timeZone: center?.time_zone ?? DEFAULT_TIMEZONE,
    candidateName: trainee.full_name,
    centerName: center?.name ?? "",
    centerLogoUrl: center?.logo_url ?? null,
    courseName: course.name,
    courseDates: `${formatCalendarDate(course.start_date)} - ${formatCalendarDate(course.end_date, { year: "numeric" })}`,
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
  files.push({
    name: `Cover sheet - ${safeName(ASSIGNMENT_INFO[assignment.assignment_type].title)}.pdf`,
    mimeType: "application/pdf",
    bytes: buffer,
  });
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
  const { buffer: withMaterials, unmerged } = await buildTpRecordWithMaterials(admin, base, plan.id);
  files.push({ name: `TP${tp_number} record - ${safeName(trainee.full_name)}.pdf`, mimeType: "application/pdf", bytes: withMaterials });
  for (const m of unmerged) {
    const ext = m.name.includes(".") ? "" : m.mimeType.includes("wordprocessing") ? ".docx" : m.mimeType.includes("presentation") ? ".pptx" : "";
    files.push({ name: `TP${tp_number} material - ${safeName(m.name)}${ext}`, mimeType: m.mimeType, bytes: m.bytes });
  }
}

// Observations log
const { data: observations } = await admin
  .from("observations")
  .select("observation_date, length_minutes, level, learners_present, lesson_focus, filmed")
  .eq("course_id", courseId)
  .eq("trainee_id", trainee.id)
  .order("observation_date");
files.push({
  name: `Observations log - ${safeName(trainee.full_name)}.pdf`,
  mimeType: "application/pdf",
  bytes: await renderObservationsLogBuffer({
    traineeName: trainee.full_name,
    courseName: course.name,
    observations: observations ?? [],
  }),
});
  return files;
}
