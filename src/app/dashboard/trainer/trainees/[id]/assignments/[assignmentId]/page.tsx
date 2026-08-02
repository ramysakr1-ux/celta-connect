import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { AssignmentReviewForm } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/review-form";
import { updateAssignmentDueDate } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";

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

  const round: "first" | "resubmission" = assignment.first_status === "resubmission_required" ? "resubmission" : "first";
  const roundStatus = round === "resubmission" ? assignment.resubmission_status : assignment.first_status;

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
        <AssignmentReviewForm assignmentId={assignmentId} sections={template.sections} responses={responses ?? []} round={round} />
      )}
    </div>
  );
}
