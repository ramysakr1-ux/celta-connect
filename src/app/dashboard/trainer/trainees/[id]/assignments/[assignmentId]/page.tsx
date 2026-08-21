import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { AssignmentReviewForm } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/review-form";
import { updateAssignmentDueDate } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";
import { isAssignmentWarningTriggered, buildAssignmentWarningDraft } from "@/lib/letters/assignment-warning";
import { getAssignmentCriteria } from "@/lib/assignment-criteria";
import { checkAiCitationShape, AI_CITATION_MISMATCH_LABEL } from "@/lib/ai-declaration-check";
import { AssignmentWarningLetterSection } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/assignment-warning-letter-section";

export default async function TrainerAssignmentReviewPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const trainer = await requireRole("trainer");
  const { id, assignmentId } = await params;
  const supabase = await createClient();

  const { data: trainee } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!trainee || trainee.course_id !== trainer.course_id || trainee.role !== "trainee") {
    notFound();
  }

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.trainee_id !== id) {
    notFound();
  }

  const criteria = await getAssignmentCriteria(supabase, trainer.center_id, assignment.assignment_type);

  const { data: template } = await supabase
    .from("assignment_templates")
    .select("*")
    .eq("center_id", trainer.center_id)
    .eq("assignment_type", assignment.assignment_type)
    .not("published_at", "is", null)
    .maybeSingle();

  const { data: responses } = await supabase
    .from("assignment_section_responses")
    .select("*")
    .eq("assignment_id", assignmentId);

  const { data: secondMarkerRows } = trainee.course_id
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("course_id", trainee.course_id)
        .eq("role", "trainer")
        .neq("id", trainer.id)
        .order("full_name")
    : { data: [] };

  const round: "first" | "resubmission" = assignment.first_status === "resubmission_required" ? "resubmission" : "first";
  const roundStatus = round === "resubmission" ? assignment.resubmission_status : assignment.first_status;

  // connect-spec-corrections-for-claude-code.md item 8, soft flags 4-5:
  // advisory only, computed at marking time from the round actually being
  // reviewed -- never blocks, never auto-fails, never auto-passes.
  const aiDeclared = round === "resubmission" ? assignment.resubmission_ai_declared : assignment.first_ai_declared;
  const aiConversationUrl = round === "resubmission" ? assignment.resubmission_ai_conversation_url : assignment.first_ai_conversation_url;
  const fullSubmittedText = (responses ?? [])
    .map((r) => (round === "resubmission" ? r.resubmission_response : r.first_response) ?? "")
    .join("\n\n");
  const aiCitationMismatch = checkAiCitationShape(fullSubmittedText, aiDeclared);
  const registerNote = round === "resubmission" ? assignment.resubmission_register_note : assignment.first_register_note;

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">
            {trainee.full_name} -- {ASSIGNMENT_INFO[assignment.assignment_type].title}
          </h1>
          <p className="mt-1 text-sm text-muted">Status: {roundStatus.replace(/_/g, " ")}</p>
        </div>
        <Link href={`/dashboard/trainer/trainees/${id}`} className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary">
          Back to {trainee.full_name}
        </Link>
      </div>

      <div className="card p-6">
        <form action={updateAssignmentDueDate} className="flex items-end gap-3">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Deadline</label>
            <input
              type="date"
              name="due_date"
              defaultValue={assignment.due_date ?? ""}
              className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <button type="submit" className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary">
            Save deadline
          </button>
        </form>
      </div>

      {isAssignmentWarningTriggered(assignment) ? (
        <AssignmentWarningLetterSection
          traineeId={id}
          assignmentId={assignmentId}
          draft={(await buildAssignmentWarningDraft(supabase, trainer.course_id ?? "", assignmentId, trainer.full_name))?.input ?? null}
          existingLetters={
            (
              await supabase
                .from("formal_letters")
                .select("id, issued_at, acknowledged_at")
                .eq("related_assignment_id", assignmentId)
                .eq("letter_type", "assignment_warning")
                .order("issued_at", { ascending: false })
            ).data ?? []
          }
        />
      ) : null}

      {roundStatus === "submitted" ? (
        <div className="card flex flex-col gap-1 p-4">
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
          {aiCitationMismatch ? (
            <p className="text-sm text-status-warning-text">{AI_CITATION_MISMATCH_LABEL[aiCitationMismatch]}</p>
          ) : null}
          {registerNote ? <p className="text-sm text-status-warning-text">Language pre-check: {registerNote}</p> : null}
        </div>
      ) : null}

      {!template ? (
        <div className="card p-6">
          <p className="text-muted">This assignment&apos;s brief hasn&apos;t been published yet.</p>
        </div>
      ) : roundStatus !== "submitted" ? (
        <div className="card p-6">
          <p className="text-muted">
            Not yet submitted for this round -- nothing to review until the trainee submits.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
