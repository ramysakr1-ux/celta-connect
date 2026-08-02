import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { AssignmentAuthoringForm } from "@/app/dashboard/trainee/assignments/[assignmentId]/assignment-form";

export default async function TraineeAssignmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const trainee = await requireRole("trainee");
  const { assignmentId } = await params;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.trainee_id !== trainee.id) {
    notFound();
  }

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

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">{ASSIGNMENT_INFO[assignment.assignment_type].title}</h1>
          <p className="mt-1 text-sm text-muted">
            {assignment.due_date ? `Due ${assignment.due_date}` : "No deadline set"}
          </p>
        </div>
        <Link href="/dashboard/trainee" className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary">
          Dashboard
        </Link>
      </div>

      {!template ? (
        <div className="card p-6">
          <p className="text-muted">This assignment&apos;s brief hasn&apos;t been published yet -- check back soon.</p>
        </div>
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
