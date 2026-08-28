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
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
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

  // Ramy, 27 Aug 2026: "Assignments can stay hidden or gated until their
  // outdate" -- all four rows are created for every trainee at course-join
  // time (join/actions.ts, offer/actions.ts), which is a seed-data
  // convenience, not evidence the brief has actually been set yet. Gate on
  // the timetable's own record of when each assignment was set (the
  // earliest course_timetable_events row tagged with that
  // linked_assignment_type, reaching today) -- same "the timetable is the
  // spine" principle as everything else, not a second source of truth.
  const { data: trainee } = await supabase.from("profiles").select("course_id, center_id").eq("id", traineeId).maybeSingle();
  const timeZone = trainee?.center_id ? ((await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE) : DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  const { data: settingEvents } = trainee?.course_id
    ? await supabase
        .from("course_timetable_events")
        .select("linked_assignment_type, event_date")
        .eq("course_id", trainee.course_id)
        .not("linked_assignment_type", "is", null)
    : { data: [] };
  const setDateByAssignmentType = new Map<string, string>();
  for (const e of settingEvents ?? []) {
    if (!e.linked_assignment_type) continue;
    const existing = setDateByAssignmentType.get(e.linked_assignment_type);
    if (!existing || e.event_date < existing) setDateByAssignmentType.set(e.linked_assignment_type, e.event_date);
  }
  const isSet = (assignmentType: string) => {
    const setDate = setDateByAssignmentType.get(assignmentType);
    return Boolean(setDate && setDate <= today);
  };
  // Staff/assessor previewing always see the full set -- gating is a
  // candidate-facing pacing device, not a real access restriction (same
  // reasoning as every other staff-sees-everything carve-out in this app).
  const isStaffViewer = Boolean(assessorCourseId) || (session?.profile != null && session.profile.role !== "trainee");

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
  // for-claude-code-trainee-interface.md: "Heading: what's due, e.g. '1 due
  // today'" -- plus an "Open Assignment N" shortcut straight to it. Was
  // missing entirely; only the passed-count showed. due_date tracks
  // whichever round (first or resubmission) is currently live, same field
  // getDeadlineUrgency already reads.
  const dueTodayAssignment = standardAssignments.find(
    (a) => a.due_date === today && (a.first_status === "not_submitted" || a.resubmission_status === "not_submitted")
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl text-ink">Written Assignments</h2>
          {dueTodayAssignment ? <p className="mt-0.5 text-xs font-medium text-status-warning-text">1 due today</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {dueTodayAssignment ? (
            <Link
              href={`/portfolio/${traineeId}/assignments/${dueTodayAssignment.id}`}
              className="shrink-0 rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open Assignment {ASSIGNMENT_ORDER.indexOf(dueTodayAssignment.assignment_type) + 1}
            </Link>
          ) : null}
          <p className="text-xs text-muted">
            {passedCount} of {standardAssignments.length} passed
          </p>
        </div>
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
              locked={!isStaffViewer && !isSet(a.assignment_type)}
              today={today}
              timeZone={timeZone}
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
                today={today}
                timeZone={timeZone}
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
  locked,
  today,
  timeZone,
}: {
  traineeId: string;
  assignment: AssignmentRow;
  today: string;
  timeZone: string;
  locked?: boolean;
  eyebrow: string;
  accentClass?: string;
}) {
  const info = ASSIGNMENT_INFO[a.assignment_type];
  if (locked) {
    // "Not yet open" is one of the spec's own named outcome states
    // (for-claude-code-trainee-interface.md §4) -- gated, not hidden, so a
    // candidate sees all four exist without being able to open one before
    // its input session has actually taught it.
    return (
      <div className={`sheet flex h-full flex-col rounded-[9px] border-t-[3px] border-dashed p-5 opacity-60 ${accentClass ?? "border-t-[var(--trainee-plum)]"}`}>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{eyebrow}</p>
          <h3 className="font-serif text-lg text-ink">{info.title}</h3>
        </div>
        <p className="mt-2 text-sm text-muted">Not yet open -- this appears once the input session that sets it has run.</p>
      </div>
    );
  }
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
            <span key="due" className={DEADLINE_URGENCY_CLASS[getDeadlineUrgency(a.due_date, a.first_submitted_at, today)]}>
              Due {a.due_date}
            </span>
          ) : null,
          <span key="words">{ASSIGNMENT_WORD_COUNT}</span>,
          a.first_submitted_at ? <span key="submitted">Submitted {toLocalIso(new Date(a.first_submitted_at), timeZone)}</span> : null,
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
    </Link>
  );
}
