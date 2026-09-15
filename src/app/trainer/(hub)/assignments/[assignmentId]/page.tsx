import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ASSIGNMENT_INFO, ASSIGNMENT_RESULT_LABEL, resolveAssignmentResult } from "@/lib/assignment-info";
import { SecondMarkingPanel } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/second-marking-panel";
import { AssignmentMarkingForm, type MarkingStage } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/marking-form";
import { updateAssignmentDueDate } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";
import { FindingsBand } from "@/app/trainer/(hub)/malpractice/findings-band";
import { RaiseConcernForm } from "@/app/trainer/(hub)/malpractice/raise-concern-form";
import { FolCrossCheck } from "@/app/portfolio/[traineeId]/assignments/[assignmentId]/fol-cross-check";
import { PageHead, HUB_BUTTON } from "@/app/trainer/(hub)/page-head";
import { getAssignmentCriteria } from "@/lib/assignment-criteria";
import { resolveBrief } from "@/lib/assignment-brief";
import { checkAiCitationShape, AI_CITATION_MISMATCH_LABEL } from "@/lib/ai-declaration-check";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { formatCalendarDate } from "@/lib/format-date";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// Ramy, 14 Sep 2026: "when a trainer opens the assignment to mark, why is it
// that the trainer is landing in the trainee's page? I only need to see the
// assignment that I am marking. I don't need to see Amara's view. I don't
// need to preview it as a trainee."
//
// He was right, and it was his own rule being broken (one room, one door).
// The board linked to /portfolio/:traineeId/assignments/:id, so marking took
// place inside the CANDIDATE'S shell -- her sidebar, her day bar, her tabs,
// her notebook -- and the marking screen carried a "?preview=trainee" toggle
// that only existed because it was squatting in her room.
//
// The tutor's marking room now lives in the tutor's building, and takes only
// the assignment id: the candidate is whoever the assignment belongs to.
// What used to be `isEditableStaff` in the portfolio page is all here; that
// page is now just the candidate's document and the assessor's read-only
// record, which is all it ever should have been.
export default async function TrainerMarkAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  await requireRole("trainer");
  const { assignmentId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  if (!viewer) notFound();

  const supabase = await createClient();

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (!assignment) notFound();

  // RLS scopes `assignments` to the viewer's own course already; the trainee
  // lookup below is the same client, so a tutor cannot reach a candidate
  // outside it. No second authorization check to duplicate here.
  const { data: trainee } = await supabase
    .from("profiles")
    .select("id, full_name, center_id, course_id")
    .eq("id", assignment.trainee_id)
    .maybeSingle();
  if (!trainee) notFound();
  const traineeId = trainee.id;

  const criteria = await getAssignmentCriteria(supabase, trainee.center_id, assignment.assignment_type);
  // The version the candidate answered, once submitted (migration 0300).
  const template = await resolveBrief(supabase, assignment, trainee.center_id);

  const { data: responses } = await supabase
    .from("assignment_section_responses")
    .select("*")
    .eq("assignment_id", assignmentId);

  const markerIds = [assignment.marker_id, assignment.second_marker_id].filter((x): x is string => Boolean(x));
  const { data: markerRows } =
    markerIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", markerIds) : { data: [] };
  const markerName = new Map((markerRows ?? []).map((m) => [m.id, m.full_name]));
  const result = resolveAssignmentResult(assignment);

  const { data: secondMarkerRows } = trainee.course_id
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("course_id", trainee.course_id)
        .eq("role", "trainer")
        .neq("id", viewer.id)
        .order("full_name")
    : { data: [] };

  let round: "first" | "resubmission";
  if (assignment.first_status === "not_submitted") round = "first";
  else if (assignment.first_status === "resubmission_required") round = "resubmission";
  else round = "first";

  const { data: findingRows } = await supabase
    .from("plagiarism_scanner_findings")
    .select("id, section_key, matched_text, match_length, source_type, source_course_label, reviewed_at")
    .eq("assignment_id", assignmentId)
    .eq("round", round);
  const findings = (findingRows ?? []).map((f) => ({
    id: f.id,
    sectionKey: f.section_key,
    matchedText: f.matched_text,
    matchLength: f.match_length,
    sourceType: f.source_type,
    sourceCourseLabel: f.source_course_label,
    reviewedAt: f.reviewed_at,
  }));

  // The FoL cross-check reads the candidate's own claims against the pooled
  // error log -- a tutor-only check that the learner they wrote about is one
  // they actually observed.
  const isFol = assignment.assignment_type === "Focus on Learner";
  let folCross: {
    claims: { id: string; candidate_id: string; problem_type: string; problem_description: string; source: string }[];
    poolEntries: { id: string; learnerName: string; tp_class: string; tp_number: number; problem_type: "grammar" | "pronunciation"; note: string; logged_at: string }[];
  } | null = null;
  if (isFol && trainee.course_id) {
    const [{ data: learnerRows }, { data: logRows }, { data: claimRows }] = await Promise.all([
      supabase.from("volunteer_students").select("id, name").eq("course_id", trainee.course_id).is("removed_at", null),
      supabase
        .from("class_error_log")
        .select("id, tp_class, tp_number, problem_type, note, logged_at, learner_id")
        .eq("course_id", trainee.course_id)
        .order("logged_at", { ascending: false })
        .limit(50),
      supabase
        .from("fol_claims")
        .select("id, candidate_id, problem_type, problem_description, source")
        .eq("course_id", trainee.course_id)
        .eq("candidate_id", traineeId),
    ]);
    const learnerNameById = new Map((learnerRows ?? []).map((l) => [l.id, l.name]));
    folCross = {
      claims: claimRows ?? [],
      poolEntries: (logRows ?? []).map((r) => ({
        id: r.id,
        learnerName: learnerNameById.get(r.learner_id) ?? "Unknown",
        tp_class: r.tp_class,
        tp_number: r.tp_number,
        problem_type: r.problem_type,
        note: r.note,
        logged_at: r.logged_at,
      })),
    };
  }

  const timeZone = (await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE;

  // Migration 0302 -- what the candidate attached for the round on show.
  const { data: appendixRows } = await supabase
    .from("assignment_appendices")
    .select("id, label, file_name, storage_path, link_url, round")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });
  const appendices = (appendixRows ?? []).filter((a) => a.round === round);

  const roundStatus = round === "resubmission" ? assignment.resubmission_status : assignment.first_status;

  // Which stage of the marking cycle this is. A blind second marker sees the
  // blind stage until they have recorded their own marks -- that is what
  // makes it blind.
  const markingStage: MarkingStage =
    assignment.first_status === "approved" || assignment.resubmission_status === "approved" || assignment.final_grade === "Fail"
      ? "closed"
      : assignment.second_marks_recorded_at && assignment.second_mark_round === round
        ? "agree"
        : assignment.second_marker_id === viewer.id && assignment.marker_id !== viewer.id
          ? "second"
          : round === "resubmission"
            ? "round2"
            : "round1";

  const canExportCoverSheet = assignment.first_status === "approved" || assignment.first_status === "resubmission_required";
  const aiDeclared = round === "resubmission" ? assignment.resubmission_ai_declared : assignment.first_ai_declared;
  const aiConversationUrl = round === "resubmission" ? assignment.resubmission_ai_conversation_url : assignment.first_ai_conversation_url;
  const fullSubmittedText = (responses ?? [])
    .map((r) => (round === "resubmission" ? r.resubmission_response : r.first_response) ?? "")
    .join("\n\n");
  const aiCitationMismatch = checkAiCitationShape(fullSubmittedText, aiDeclared);
  const registerNote = round === "resubmission" ? assignment.resubmission_register_note : assignment.first_register_note;
  const title = ASSIGNMENT_INFO[assignment.assignment_type]?.title ?? assignment.assignment_type;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/trainer/assignments" label="Assignments" />

      <PageHead
        eyebrow={`${trainee.full_name} · ${ASSIGNMENT_RESULT_LABEL[result]}${round === "resubmission" && roundStatus === "submitted" ? " · resubmission in" : ""}${assignment.first_submitted_late ? " · first submission late" : ""}`}
        title={title}
      >
        {canExportCoverSheet ? (
          <a href={`/api/portfolio/${traineeId}/assignments/${assignmentId}/cover-sheet`} className={HUB_BUTTON}>
            Export cover sheet + assignment PDF
          </a>
        ) : null}
      </PageHead>

      <div className="sheet">
        <form action={updateAssignmentDueDate} className="flex items-end gap-3">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Deadline</label>
            <input
              type="date"
              name="due_date"
              defaultValue={assignment.due_date ?? ""}
              className="rounded-[6px] border border-input bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <button type="submit" className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink wash">
            Save deadline
          </button>
        </form>
      </div>

      <SecondMarkingPanel
        assignmentId={assignmentId}
        traineeId={traineeId}
        viewerId={viewer.id}
        markerId={assignment.marker_id}
        markerName={assignment.marker_id ? (markerName.get(assignment.marker_id) ?? null) : null}
        secondMarkerId={assignment.second_marker_id}
        secondMarkerName={assignment.second_marker_id ? (markerName.get(assignment.second_marker_id) ?? null) : null}
        secondMarkerRecordedAt={assignment.second_marker_recorded_at}
        decided={result === "pass_first" || result === "pass_resub" || result === "resubmission_required" || result === "fail"}
        failed={result === "fail"}
        timeZone={timeZone}
        garnet
      />

      {!template ? (
        <div className="sheet sheet-garnet p-6">
          <p className="text-muted">This assignment&apos;s brief hasn&apos;t been published yet.</p>
        </div>
      ) : assignment.open_case_id ? (
        <div className="sheet sheet-garnet flex flex-col gap-2 p-6">
          <p className="pill pill-warning w-fit">Marking paused</p>
          <p className="text-muted">
            A malpractice case is open on this submission. No outcome can be recorded until it&apos;s decided.
          </p>
          <Link
            href={`/trainer/malpractice/${assignment.open_case_id}`}
            className="mt-1 self-start rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink wash"
          >
            Open the case
          </Link>
        </div>
      ) : roundStatus === "not_submitted" || roundStatus === "resubmission_required" ? (
        // "Nothing to review" only when there is genuinely nothing. A CLOSED
        // assignment has been submitted and marked, and a tutor opening it
        // should see the finished document read-only.
        <div className="sheet sheet-garnet p-6">
          <p className="text-muted">
            Not yet submitted for this round — nothing to review until {trainee.full_name.split(" ")[0]} submits.
          </p>
          <p className="mt-1 text-sm text-muted">
            Due {assignment.due_date ? formatCalendarDate(assignment.due_date, { year: "numeric" }) : "— no deadline set"}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="sheet sheet-garnet flex flex-col gap-1">
            <p className="text-sm text-ink">
              AI declaration: {aiDeclared ? "used" : "not used"}
              {aiDeclared && aiConversationUrl ? (
                <>
                  {" — "}
                  <a href={aiConversationUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    conversation link
                  </a>
                </>
              ) : null}
            </p>
            {aiCitationMismatch ? <p className="text-sm text-status-warning-text">{AI_CITATION_MISMATCH_LABEL[aiCitationMismatch]}</p> : null}
            {registerNote ? <p className="text-sm text-status-warning-text">Language pre-check: {registerNote}</p> : null}
          </div>

          {isFol && folCross ? <FolCrossCheck claims={folCross.claims} poolEntries={folCross.poolEntries} /> : null}
          <FindingsBand findings={findings} assignmentId={assignmentId} round={round} traineeId={traineeId} />

          <AssignmentMarkingForm
            assignmentId={assignmentId}
            candidateName={trainee.full_name}
            title={title}
            sections={template.sections}
            responses={responses ?? []}
            criteria={criteria.map((c) => ({ key: c.key, text: c.text }))}
            round={round}
            stage={markingStage}
            sanction={assignment.assignment_type === "Plagiarism Reflection"}
            format={template.format}
            intro={ASSIGNMENT_INFO[assignment.assignment_type]?.description ?? null}
            marks={(round === "resubmission" ? assignment.resubmission_criteria_marks : assignment.first_criteria_marks) ?? {}}
            secondMarks={assignment.second_criteria_marks ?? {}}
            overallComment={round === "resubmission" ? assignment.resubmission_overall_comment : assignment.first_overall_comment}
            secondOverallComment={assignment.second_overall_comment}
            priorOverallComment={round === "resubmission" ? assignment.first_overall_comment : null}
            firstMarkerName={markerName.get(assignment.marker_id ?? "") ?? null}
            secondMarkerName={markerName.get(assignment.second_marker_id ?? "") ?? null}
            viewerIsFirstMarker={assignment.marker_id === viewer.id}
            viewerIsSecondMarker={assignment.second_marker_id === viewer.id}
            firstInitialledAt={assignment.first_initialled_at}
            secondInitialledAt={assignment.second_initialled_at}
            inSample={assignment.in_double_marking_sample}
            appendices={appendices}
            timeZone={timeZone}
            secondMarkerOptions={secondMarkerRows ?? []}
            submittedLabel={
              assignment.first_submitted_at
                ? `Submitted ${formatCalendarDate((round === "resubmission" ? assignment.resubmission_submitted_at : assignment.first_submitted_at)?.slice(0, 10) ?? null)}`
                : "Submitted"
            }
          />

          {assignment.assignment_type !== "Plagiarism Reflection" ? (
            <RaiseConcernForm
              assignmentId={assignmentId}
              round={round}
              ownSubmissionLabel={`${trainee.full_name} — ${title} (${round === "first" ? "1st submission" : "resubmission"})`}
              aiDeclared={aiDeclared}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
