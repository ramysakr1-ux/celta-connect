import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import {
  ASSIGNMENT_INFO,
  ASSIGNMENT_ORDER,
  ASSIGNMENT_WORD_COUNT,
  ASSIGNMENT_STATUS_PILL_CLASS as STATUS_PILL_CLASS,
  ASSIGNMENT_STATUS_LABEL as STATUS_LABEL,
} from "@/lib/assignment-info";
import { DEADLINE_URGENCY_CLASS, getDeadlineUrgency } from "@/lib/deadline";
import type { Database } from "@/lib/supabase/types";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

// §8 -- restyle of the existing assignments grid (dashboard/trainee), same
// `assignments` rows/statuses, just re-linked into the portfolio shell and
// keyed by the :traineeId param instead of the logged-in trainee so staff
// can view any trainee's assignments too.
export default async function AssignmentsPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const assessorCourseId = !session?.profile ? await getAssessorCourseId() : null;
  if (!session?.profile && !assessorCourseId) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  if (assessorCourseId) {
    const { data: trainee } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
    if (!trainee || trainee.course_id !== assessorCourseId) notFound();
  }

  const { data: assignmentsRaw } = await supabase.from("assignments").select("*").eq("trainee_id", traineeId);
  // build-spec.md "Assignment 5": "not numbered as a Cambridge assignment
  // in the candidate's workspace... keep it visually distinct from the
  // four" -- and "does not count toward the 3-of-4 rule". Split out here
  // so it can neither pollute the other four's numbering (ASSIGNMENT_ORDER
  // has no entry for it, which previously sorted it to the front as
  // "Assignment 1") nor the passed-count denominator below.
  const standardAssignments = (assignmentsRaw ?? [])
    .filter((a) => a.assignment_type !== "Plagiarism Reflection")
    .sort((a, b) => ASSIGNMENT_ORDER.indexOf(a.assignment_type) - ASSIGNMENT_ORDER.indexOf(b.assignment_type));
  const reflectionAssignments = (assignmentsRaw ?? []).filter((a) => a.assignment_type === "Plagiarism Reflection");
  const passedCount = standardAssignments.filter(
    (a) => a.first_status === "approved" || a.resubmission_status === "approved"
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">Written Assignments</h2>
        <p className="text-xs text-muted">
          {passedCount} of {standardAssignments.length} passed
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-fr">
        {standardAssignments.length > 0 ? (
          standardAssignments.map((a, i) => (
            <AssignmentCard
              key={a.id}
              traineeId={traineeId}
              assignment={a}
              eyebrow={`Assignment ${i + 1}`}
              accentClass={(Math.floor(i / 2) + (i % 2)) % 2 === 0 ? "border-t-[oklch(38%_0.085_155)]" : "border-t-[oklch(42%_0.13_27)]"}
            />
          ))
        ) : (
          <p className="sheet text-sm text-muted">No assignments yet.</p>
        )}
      </div>

      {reflectionAssignments.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
            Plagiarism reflection -- a centre sanction, not a Cambridge assignment
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-fr">
            {reflectionAssignments.map((a) => (
              <AssignmentCard
                key={a.id}
                traineeId={traineeId}
                assignment={a}
                eyebrow="Plagiarism case"
                accentClass="border-border"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssignmentCard({
  traineeId,
  assignment: a,
  eyebrow,
  accentClass,
}: {
  traineeId: string;
  assignment: AssignmentRow;
  eyebrow: string;
  accentClass?: string;
}) {
  const info = ASSIGNMENT_INFO[a.assignment_type];
  return (
    <Link
      href={`/portfolio/${traineeId}/assignments/${a.id}`}
      className={`sheet trainee-hover group flex h-full flex-col rounded-[9px] border-t-[3px] p-5 ${accentClass ?? "border-t-[var(--trainee-plum)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{eyebrow}</p>
          <h3 className="font-serif text-lg text-ink">{info.title}</h3>
        </div>
        <span className={`pill ${STATUS_PILL_CLASS[a.first_status]}`}>{STATUS_LABEL[a.first_status]}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-muted">{info.description}</p>

      <p className="mt-3 text-xs text-muted">
        {[
          a.due_date ? (
            <span key="due" className={DEADLINE_URGENCY_CLASS[getDeadlineUrgency(a.due_date, a.first_submitted_at)]}>
              Due {a.due_date}
            </span>
          ) : null,
          <span key="words">{ASSIGNMENT_WORD_COUNT}</span>,
          a.first_submitted_at ? <span key="submitted">Submitted {a.first_submitted_at.slice(0, 10)}</span> : null,
        ]
          .filter(Boolean)
          .flatMap((node, idx) => (idx > 0 ? [" · ", node] : [node]))}
      </p>

      {a.first_status === "resubmission_required" ? (
        <div className="mt-3 flex items-center justify-between border-t border-border-faint pt-3">
          <span className="text-xs text-muted">Resubmission</span>
          <span className={`pill ${STATUS_PILL_CLASS[a.resubmission_status]}`}>{STATUS_LABEL[a.resubmission_status]}</span>
        </div>
      ) : null}

      <div className="mt-3 border-t border-border-faint pt-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Tutor feedback</p>
        <p className="mt-1 line-clamp-2 text-sm text-ink">{a.tutor_feedback || "No feedback yet."}</p>
      </div>

      {a.final_grade ? <p className="mt-2 text-xs text-muted">Final grade: {a.final_grade}</p> : null}
    </Link>
  );
}
