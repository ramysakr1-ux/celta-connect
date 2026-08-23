import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { AssignmentAuthoringForm } from "@/app/dashboard/trainee/assignments/[assignmentId]/assignment-form";
import { AssignmentReviewForm } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/review-form";
import { updateAssignmentDueDate } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";
import { OpenCaseButton } from "@/app/trainer/(hub)/malpractice/open-case-button";
import { FindingsBand } from "@/app/trainer/(hub)/malpractice/findings-band";
import { FolPanel } from "@/app/portfolio/[traineeId]/assignments/[assignmentId]/fol-panel";
import { FolCrossCheck } from "@/app/portfolio/[traineeId]/assignments/[assignmentId]/fol-cross-check";
import { isCourseDayReached } from "@/lib/course-day";
import { getAssignmentCriteria } from "@/lib/assignment-criteria";
import { checkAiCitationShape, AI_CITATION_MISMATCH_LABEL } from "@/lib/ai-declaration-check";

// §8 detail -- trainee viewers get the real editable pipeline
// (AssignmentAuthoringForm, exactly as built for
// /dashboard/trainee/assignments/[assignmentId] -- same tables, same
// Server Actions). Staff viewers get the due-date editor plus the real
// AssignmentReviewForm for grading, mirroring
// /dashboard/trainer/trainees/[id]/assignments/[assignmentId].
export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string; assignmentId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId, assignmentId } = await params;
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  // Raw role check for the access gate -- see the TP detail page's
  // identical comment for why this can't fold in previewAsTrainee.
  const isRealStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  if (viewer && !isRealStaff && viewer.id !== traineeId) notFound();
  const isEditableStaff = isRealStaff && preview !== "trainee";
  const isStaff = isEditableStaff || Boolean(assessorCourseId);

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("id, full_name, center_id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.trainee_id !== traineeId) notFound();

  const criteria = await getAssignmentCriteria(supabase, trainee.center_id, assignment.assignment_type);

  const { data: template } = await supabase
    .from("assignment_templates")
    .select("*")
    .eq("center_id", trainee.center_id)
    .eq("assignment_type", assignment.assignment_type)
    .not("published_at", "is", null)
    .maybeSingle();

  const { data: responses } = await supabase
    .from("assignment_section_responses")
    .select("*")
    .eq("assignment_id", assignmentId);

  const { data: secondMarkerRows } = isEditableStaff && trainee.course_id
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("course_id", trainee.course_id)
        .eq("role", "trainer")
        .neq("id", viewer!.id)
        .order("full_name")
    : { data: [] };

  let round: "first" | "resubmission";
  let locked: boolean;
  if (assignment.first_status === "not_submitted") {
    round = "first";
    locked = false;
  } else if (assignment.first_status === "resubmission_required") {
    round = "resubmission";
    locked = assignment.resubmission_status !== "not_submitted";
  } else {
    round = "first";
    locked = true;
  }

  const { data: findingRows } = isEditableStaff
    ? await supabase
        .from("plagiarism_scanner_findings")
        .select("id, section_key, matched_text, match_length, source_type, source_course_label, reviewed_at")
        .eq("assignment_id", assignmentId)
        .eq("round", round)
    : { data: [] };
  const findings = (findingRows ?? []).map((f) => ({
    id: f.id,
    sectionKey: f.section_key,
    matchedText: f.matched_text,
    matchLength: f.match_length,
    sourceType: f.source_type,
    sourceCourseLabel: f.source_course_label,
    reviewedAt: f.reviewed_at,
  }));

  const isFol = assignment.assignment_type === "Focus on Learner";
  let folData: {
    learners: { id: string; name: string }[];
    poolEntries: { id: string; learnerName: string; tp_class: string; tp_number: number; problem_type: "grammar" | "pronunciation"; note: string; logged_at: string }[];
    myClaims: { id: string; problem_type: "grammar" | "pronunciation"; problem_description: string; source: "pooled_log" | "signup_recording"; claimed_at: string }[];
    day10Reached: boolean;
    defaultTpClass: string;
    allClaimsForCrossCheck: { id: string; candidate_id: string; problem_type: string; problem_description: string; source: string }[];
  } | null = null;

  if (isFol && trainee.course_id) {
    const [{ data: learnerRows }, { data: logRows }, { data: myClaimRows }, { data: subgroupRow }, day10Reached] = await Promise.all([
      supabase.from("volunteer_students").select("id, name").eq("course_id", trainee.course_id).is("removed_at", null).order("name"),
      supabase
        .from("class_error_log")
        .select("id, tp_class, tp_number, problem_type, note, logged_at, learner_id")
        .eq("course_id", trainee.course_id)
        .order("logged_at", { ascending: false })
        .limit(50),
      supabase
        .from("fol_claims")
        .select("id, problem_type, problem_description, source, claimed_at")
        .eq("course_id", trainee.course_id)
        .eq("candidate_id", traineeId),
      supabase
        .from("course_subgroup_members")
        .select("course_subgroups(name)")
        .eq("trainee_id", traineeId)
        .maybeSingle(),
      isCourseDayReached(supabase, trainee.course_id, 10),
    ]);

    const learnerNameById = new Map((learnerRows ?? []).map((l) => [l.id, l.name]));
    const { data: allClaims } = isEditableStaff
      ? await supabase
          .from("fol_claims")
          .select("id, candidate_id, problem_type, problem_description, source")
          .eq("course_id", trainee.course_id)
          .eq("candidate_id", traineeId)
      : { data: [] };

    folData = {
      learners: learnerRows ?? [],
      poolEntries: (logRows ?? []).map((r) => ({
        id: r.id,
        learnerName: learnerNameById.get(r.learner_id) ?? "Unknown",
        tp_class: r.tp_class,
        tp_number: r.tp_number,
        problem_type: r.problem_type,
        note: r.note,
        logged_at: r.logged_at,
      })),
      myClaims: myClaimRows ?? [],
      day10Reached,
      defaultTpClass: (subgroupRow?.course_subgroups as unknown as { name: string } | null)?.name ?? "",
      allClaimsForCrossCheck: allClaims ?? [],
    };
  }

  const deadlinePassed = Boolean(
    assignment.due_date && round === "first" && !locked && new Date(assignment.due_date) < new Date()
  );
  const roundStatus = round === "resubmission" ? assignment.resubmission_status : assignment.first_status;
  const canExportCoverSheet = assignment.first_status === "approved" || assignment.first_status === "resubmission_required";

  // connect-spec-corrections-for-claude-code.md item 8, soft flags 4-5.
  const aiDeclared = round === "resubmission" ? assignment.resubmission_ai_declared : assignment.first_ai_declared;
  const aiConversationUrl = round === "resubmission" ? assignment.resubmission_ai_conversation_url : assignment.first_ai_conversation_url;
  const fullSubmittedText = (responses ?? [])
    .map((r) => (round === "resubmission" ? r.resubmission_response : r.first_response) ?? "")
    .join("\n\n");
  const aiCitationMismatch = checkAiCitationShape(fullSubmittedText, aiDeclared);
  const registerNote = round === "resubmission" ? assignment.resubmission_register_note : assignment.first_register_note;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/portfolio/${traineeId}/assignments`} className="text-sm text-muted hover:text-primary">
        ← All assignments
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">{ASSIGNMENT_INFO[assignment.assignment_type].title}</h1>
          <p className="mt-1 text-sm text-muted">
            {isStaff
              ? `Status: ${roundStatus.replace(/_/g, " ")}${assignment.first_submitted_late ? " · submitted late" : ""}`
              : assignment.due_date
                ? `Due ${assignment.due_date}`
                : "No deadline set"}
          </p>
        </div>
        {canExportCoverSheet ? (
          <a
            href={`/api/portfolio/${traineeId}/assignments/${assignmentId}/cover-sheet`}
            className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink trainee-hover"
          >
            Export cover sheet + assignment PDF
          </a>
        ) : (
          <span
            className="shrink-0 cursor-not-allowed rounded-[6px] border border-border px-4 py-2 text-sm text-muted"
            title="Available once the first round has been submitted and returned"
          >
            Export cover sheet + assignment PDF
          </span>
        )}
      </div>

      {isEditableStaff ? (
        <div className="sheet">
          <form action={updateAssignmentDueDate} className="flex items-end gap-3">
            <input type="hidden" name="assignment_id" value={assignmentId} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted">Deadline</label>
              <input
                type="date"
                name="due_date"
                defaultValue={assignment.due_date ?? ""}
                className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <button type="submit" className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink trainee-hover">
              Save deadline
            </button>
          </form>
        </div>
      ) : assessorCourseId && assignment.due_date ? (
        <p className="text-sm text-muted">Due {assignment.due_date}</p>
      ) : null}

      {!template ? (
        <div className="sheet p-6">
          <p className="text-muted">
            {isStaff
              ? "This assignment's brief hasn't been published yet."
              : "This assignment's brief hasn't been published yet -- check back soon."}
          </p>
        </div>
      ) : isEditableStaff && assignment.open_case_id ? (
        <div className="sheet flex flex-col gap-2 p-6">
          <p className="pill pill-warning w-fit">Marking paused</p>
          <p className="text-muted">
            A malpractice case is open on this submission. No outcome can be recorded until it&apos;s decided.
          </p>
          <Link
            href={`/trainer/malpractice/${assignment.open_case_id}`}
            className="mt-1 self-start rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover"
          >
            Open the case →
          </Link>
        </div>
      ) : isEditableStaff ? (
        roundStatus !== "submitted" ? (
          <div className="sheet p-6">
            <p className="text-muted">Not yet submitted for this round -- nothing to review until the trainee submits.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="sheet flex flex-col gap-1">
              <p className="text-sm text-ink">
                AI declaration: {aiDeclared ? "used" : "not used"}
                {aiDeclared && aiConversationUrl ? (
                  <>
                    {" -- "}
                    <a href={aiConversationUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      conversation link
                    </a>
                  </>
                ) : null}
              </p>
              {aiCitationMismatch ? <p className="text-sm text-status-warning-text">{AI_CITATION_MISMATCH_LABEL[aiCitationMismatch]}</p> : null}
              {registerNote ? <p className="text-sm text-status-warning-text">Language pre-check: {registerNote}</p> : null}
            </div>
            {isFol && folData ? <FolCrossCheck claims={folData.allClaimsForCrossCheck} poolEntries={folData.poolEntries} /> : null}
            <FindingsBand findings={findings} assignmentId={assignmentId} round={round} traineeId={traineeId} />
            <AssignmentReviewForm
              assignmentId={assignmentId}
              assignmentType={assignment.assignment_type}
              sections={template.sections}
              responses={responses ?? []}
              round={round}
              criteriaMarks={(round === "resubmission" ? assignment.resubmission_criteria_marks : assignment.first_criteria_marks) ?? {}}
              criteria={criteria}
              secondMarkerOptions={secondMarkerRows ?? []}
            />
            {assignment.assignment_type !== "Plagiarism Reflection" ? (
              <OpenCaseButton assignmentId={assignmentId} round={round} />
            ) : null}
          </div>
        )
      ) : assessorCourseId ? (
        assignment.first_status === "not_submitted" ? (
          <div className="sheet p-6">
            <p className="text-muted">Not yet submitted.</p>
          </div>
        ) : (
          <AssignmentAuthoringForm
            assignmentId={assignment.id}
            sections={template.sections}
            responses={responses ?? []}
            round={round}
            locked
            deadlinePassed={false}
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {isFol && folData ? (
            <FolPanel
              learners={folData.learners}
              poolEntries={folData.poolEntries}
              myClaims={folData.myClaims}
              day10Reached={folData.day10Reached}
              defaultTpClass={folData.defaultTpClass}
            />
          ) : null}
          <AssignmentAuthoringForm
            assignmentId={assignment.id}
            sections={template.sections}
            responses={responses ?? []}
            round={round}
            locked={locked}
            deadlinePassed={deadlinePassed}
            // for-claude-code-trainee-interface.md: "can withdraw only
            // while it's unopened" -- round==="first" && locked===true
            // here specifically means "submitted, not yet approved" (see
            // this file's own round/locked derivation above), the closest
            // real signal this schema has to "not yet opened."
            canWithdraw={round === "first" && locked && assignment.first_status !== "approved"}
          />
        </div>
      )}
    </div>
  );
}
