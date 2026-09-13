import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId, getPortfolioViewer } from "@/lib/auth/portfolio-access";
import {
  ASSIGNMENT_INFO,
  ASSIGNMENT_ORDER,
  ASSIGNMENT_WORD_COUNT,
  ASSIGNMENT_STATUS_PILL_CLASS as STATUS_PILL_CLASS,
  ASSIGNMENT_STATUS_LABEL as STATUS_LABEL,
  resolveAssignmentResult,
} from "@/lib/assignment-info";
import { DEADLINE_URGENCY_CLASS, getDeadlineUrgency } from "@/lib/deadline";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { getCourseReleaseClock, type AssignmentRelease } from "@/lib/assignment-release";
import { formatCalendarDate, formatDate } from "@/lib/format-date";
import type { Database } from "@/lib/supabase/types";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

// §8 -- restyle of the existing assignments grid (dashboard/trainee), same
// `assignments` rows/statuses, just re-linked into the portfolio shell and
// keyed by the :traineeId param instead of the logged-in trainee so staff
// can view any trainee's assignments too.
export default async function AssignmentsPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getPortfolioViewer();
  const assessorCourseId = !session?.profile ? await getAssessorCourseId() : null;
  if (!session?.profile && !assessorCourseId) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  if (assessorCourseId) {
    const { data: trainee } = await supabase.from("profiles").select("course_id").eq("id", traineeId).maybeSingle();
    if (!trainee || trainee.course_id !== assessorCourseId) notFound();
  }

  // When each assignment opens, off the course's own timetable -- the
  // earliest event tagged with that linked_assignment_type, which is the
  // input session that sets it.
  //
  // This used to HIDE an unopened assignment behind a stub card that could
  // not be opened. design_handoff_assignments §7 changed the rule, and it is
  // the better one: an assignment is "readable from day 1 but writable only
  // from its Released day". A candidate can read the brief and the criteria
  // for all four from the start and see when each one opens; what waits is
  // the writing. Ramy, 27 Aug 2026, had left the choice open -- "assignments
  // can stay hidden or gated until their outdate" -- and this is the gated
  // reading of it.
  const { data: trainee } = await supabase.from("profiles").select("course_id, center_id").eq("id", traineeId).maybeSingle();
  const timeZone = trainee?.center_id ? ((await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE) : DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  const clock = trainee?.course_id ? await getCourseReleaseClock(supabase, trainee.course_id, today) : null;
  // Staff/assessor previewing always see the full set -- gating is a
  // candidate-facing pacing device, not a real access restriction (same
  // reasoning as every other staff-sees-everything carve-out in this app).
  const isStaffViewer = Boolean(assessorCourseId) || (session?.profile != null && session.profile.role !== "trainee");
  const releaseFor = (assignmentType: string) =>
    isStaffViewer || !clock || clock.isOpen(assignmentType) ? null : (clock.releaseByType.get(assignmentType) ?? null);

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
  // The card's "Tutor feedback" line read assignments.tutor_feedback, which
  // the marking action never writes (comments are per section, in
  // assignment_section_responses) -- so every assignment a tutor had actually
  // marked said "No feedback yet." Fall back to the latest round's first
  // comment when the overall note is empty.
  const assignmentIds = (assignmentsRaw ?? []).map((a) => a.id);
  const { data: commentRows } =
    assignmentIds.length > 0
      ? await supabase
          .from("assignment_section_responses")
          .select("assignment_id, first_comments, resubmission_comments")
          .in("assignment_id", assignmentIds)
      : { data: [] };
  const feedbackPreview = new Map<string, string>();
  for (const r of commentRows ?? []) {
    const text = (r.resubmission_comments ?? "").trim() || (r.first_comments ?? "").trim();
    if (text && !feedbackPreview.has(r.assignment_id)) feedbackPreview.set(r.assignment_id, text);
  }
  // A pass is a pass, not a closed round: a resubmission FAIL also carries
  // resubmission_status "approved", so counting that as passed inflated the
  // "X of 4 passed" heading (a failed candidate read as one closer to the
  // 3-of-4 rule than they were). resolveAssignmentResult checks the outcome.
  const passedCount = standardAssignments.filter((a) => {
    const r = resolveAssignmentResult(a);
    return r === "pass_first" || r === "pass_resub";
  }).length;
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
              opensOn={releaseFor(a.assignment_type)}
              today={today}
              timeZone={timeZone}
              feedbackPreview={feedbackPreview.get(a.id) ?? null}
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
                feedbackPreview={feedbackPreview.get(a.id) ?? null}
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
  opensOn,
  today,
  timeZone,
  feedbackPreview,
}: {
  traineeId: string;
  assignment: AssignmentRow;
  today: string;
  timeZone: string;
  feedbackPreview: string | null;
  /** Set while the assignment is readable but not yet open for writing. */
  opensOn?: AssignmentRelease | null;
  eyebrow: string;
  accentClass?: string;
}) {
  const info = ASSIGNMENT_INFO[a.assignment_type];
  const result = resolveAssignmentResult(a);
  // §7: an unopened assignment is still a door -- the brief and the criteria
  // are readable behind it. The dashed edge says it is not open for writing;
  // the "opens D9" on the meta line says when it will be.
  const notYetOpen = Boolean(opensOn);
  return (
    <Link
      href={`/portfolio/${traineeId}/assignments/${a.id}`}
      className={`sheet trainee-hover group flex h-full flex-col rounded-[9px] border-t-[3px] p-5 ${notYetOpen ? "border-dashed" : ""} ${accentClass ?? "border-t-[var(--trainee-plum)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{eyebrow}</p>
          <h3 className="font-serif text-lg text-ink">{info.title}</h3>
        </div>
        {notYetOpen ? (
          <span className="pill pill-neutral">Not yet open</span>
        ) : result === "fail" ? (
          <span className="pill pill-danger">Fail</span>
        ) : (
          <span className={`pill ${STATUS_PILL_CLASS[a.first_status]}`}>{STATUS_LABEL[a.first_status]}</span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-sm text-muted">{info.description}</p>

      <p className="mt-3 text-xs text-muted">
        {[
          opensOn ? (
            <span key="opens" className="font-medium text-ink">
              Opens {opensOn.day ? `D${opensOn.day} · ` : ""}
              {formatCalendarDate(opensOn.date)}
            </span>
          ) : null,
          a.due_date ? (
            <span key="due" className={notYetOpen ? undefined : DEADLINE_URGENCY_CLASS[getDeadlineUrgency(a.due_date, a.first_submitted_at, today)]}>
              Due {formatCalendarDate(a.due_date)}
            </span>
          ) : null,
          <span key="words">{ASSIGNMENT_WORD_COUNT}</span>,
          a.first_submitted_at ? <span key="submitted">Submitted {formatDate(a.first_submitted_at, timeZone)}</span> : null,
        ]
          .filter(Boolean)
          .flatMap((node, idx) => (idx > 0 ? [" · ", node] : [node]))}
      </p>

      {a.first_status === "resubmission_required" && result !== "fail" ? (
        <div className="mt-3 flex items-center justify-between border-t border-border-faint pt-3">
          <span className="text-xs text-muted">Resubmission</span>
          <span className={`pill ${STATUS_PILL_CLASS[a.resubmission_status]}`}>{STATUS_LABEL[a.resubmission_status]}</span>
        </div>
      ) : null}

      <div className="mt-3 border-t border-border-faint pt-3">
        {notYetOpen ? (
          <p className="text-sm text-muted">Read the brief and the criteria now; writing starts on the day above.</p>
        ) : (
          <>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Tutor feedback</p>
            <p className="mt-1 line-clamp-2 text-sm text-ink">{a.tutor_feedback || feedbackPreview || "No feedback yet."}</p>
          </>
        )}
      </div>
    </Link>
  );
}
