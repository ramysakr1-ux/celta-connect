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

  const deadlinePassed = Boolean(
    assignment.due_date && round === "first" && !locked && new Date(assignment.due_date) < new Date()
  );
  const roundStatus = round === "resubmission" ? assignment.resubmission_status : assignment.first_status;
  const canExportCoverSheet = assignment.first_status === "approved" || assignment.first_status === "resubmission_required";

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
            className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
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
            <button type="submit" className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary">
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
      ) : isEditableStaff ? (
        roundStatus !== "submitted" ? (
          <div className="sheet p-6">
            <p className="text-muted">Not yet submitted for this round -- nothing to review until the trainee submits.</p>
          </div>
        ) : (
          <AssignmentReviewForm
            assignmentId={assignmentId}
            assignmentType={assignment.assignment_type}
            sections={template.sections}
            responses={responses ?? []}
            round={round}
            criteriaMarks={(round === "resubmission" ? assignment.resubmission_criteria_marks : assignment.first_criteria_marks) ?? {}}
            secondMarkerOptions={secondMarkerRows ?? []}
          />
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
        <AssignmentAuthoringForm
          assignmentId={assignment.id}
          sections={template.sections}
          responses={responses ?? []}
          round={round}
          locked={locked}
          deadlinePassed={deadlinePassed}
        />
      )}
    </div>
  );
}
