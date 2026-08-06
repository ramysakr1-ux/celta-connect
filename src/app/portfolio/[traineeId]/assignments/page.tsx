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
  const assignments = (assignmentsRaw ?? []).sort(
    (a, b) => ASSIGNMENT_ORDER.indexOf(a.assignment_type) - ASSIGNMENT_ORDER.indexOf(b.assignment_type)
  );
  const passedCount = assignments.filter(
    (a) => a.first_status === "approved" || a.resubmission_status === "approved"
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">Written Assignments</h2>
        <p className="text-xs text-muted">
          {passedCount} of {assignments.length} passed
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-fr">
        {assignments.length > 0 ? (
          assignments.map((a, i) => {
            const info = ASSIGNMENT_INFO[a.assignment_type];
            return (
              <Link
                key={a.id}
                href={`/portfolio/${traineeId}/assignments/${a.id}`}
                className="sheet group flex h-full flex-col p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                      Assignment {i + 1}
                    </p>
                    <h3 className="font-serif text-lg text-ink">{info.title}</h3>
                  </div>
                  <span className={`pill ${STATUS_PILL_CLASS[a.first_status]}`}>
                    {STATUS_LABEL[a.first_status]}
                  </span>
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
                    <span className={`pill ${STATUS_PILL_CLASS[a.resubmission_status]}`}>
                      {STATUS_LABEL[a.resubmission_status]}
                    </span>
                  </div>
                ) : null}

                <div className="mt-3 border-t border-border-faint pt-3">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Tutor feedback</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink">{a.tutor_feedback || "No feedback yet."}</p>
                </div>

                {a.final_grade ? <p className="mt-2 text-xs text-muted">Final grade: {a.final_grade}</p> : null}
              </Link>
            );
          })
        ) : (
          <p className="sheet text-sm text-muted">No assignments yet.</p>
        )}
      </div>
    </div>
  );
}
