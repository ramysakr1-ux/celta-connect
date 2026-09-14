import type { SupabaseClient } from "@supabase/supabase-js";
import { BackLink } from "@/components/back-link";
import { AssignmentResultSignature } from "@/app/portfolio/[traineeId]/assignments/[assignmentId]/result-signature";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId, getPortfolioViewer } from "@/lib/auth/portfolio-access";
import { ASSIGNMENT_INFO, ASSIGNMENT_RESULT_LABEL, resolveAssignmentResult } from "@/lib/assignment-info";
import { formatCalendarDate } from "@/lib/format-date";
import { AssignmentAuthoringForm } from "@/app/dashboard/trainee/assignments/[assignmentId]/assignment-form";
import { FolPanel } from "@/app/portfolio/[traineeId]/assignments/[assignmentId]/fol-panel";
import { isCourseDayReached } from "@/lib/course-day";
import { getCourseReleaseClock } from "@/lib/assignment-release";
import { getAssignmentCriteria } from "@/lib/assignment-criteria";
import { resolveBrief } from "@/lib/assignment-brief";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// The candidate's document, and the assessor's read-only record of it.
//
// It used to be the tutor's marking room as well, which meant a tutor opened
// an assignment to mark and landed inside the candidate's portfolio shell --
// her sidebar, her tabs, her notebook -- with a "?preview=trainee" toggle
// bolted on to get back out. Ramy, 14 Sep 2026: "I only need to see the
// assignment that I am marking. I don't need to see Amara's view."
// Marking is /trainer/assignments/[assignmentId] now; a tutor who reaches
// this URL is sent there.
export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ traineeId: string; assignmentId: string }>;
}) {
  const { traineeId, assignmentId } = await params;
  const session = await getPortfolioViewer();
  const viewer = session?.profile ?? null;
  // Raw role check for the access gate -- see the TP detail page's
  // identical comment for why this can't fold in previewAsTrainee.
  const isRealStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  if (viewer && !isRealStaff && viewer.id !== traineeId) notFound();
  if (isRealStaff) redirect(`/trainer/assignments/${assignmentId}`);
  // Past the redirect there are exactly two readers left: the candidate
  // themselves, and an assessor on a token. Neither marks anything.
  const isStaff = Boolean(assessorCourseId);

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("id, full_name, center_id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.trainee_id !== traineeId) notFound();

  const criteria = await getAssignmentCriteria(supabase, trainee.center_id, assignment.assignment_type);

  // The brief this assignment is read against: the version the candidate
  // answered once it is submitted, the current one while it is still a draft
  // (migration 0300 / src/lib/assignment-brief.ts).
  const template = await resolveBrief(supabase, assignment, trainee.center_id);

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

  const isFol = assignment.assignment_type === "Focus on Learner";
  let folData: {
    learners: { id: string; name: string }[];
    poolEntries: { id: string; learnerName: string; tp_class: string; tp_number: number; problem_type: "grammar" | "pronunciation"; note: string; logged_at: string }[];
    myClaims: { id: string; problem_type: "grammar" | "pronunciation"; problem_description: string; source: "pooled_log" | "signup_recording"; claimed_at: string }[];
    day10Reached: boolean;
    defaultTpClass: string;
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
    };
  }

  // Ramy, 28 Aug 2026: "the logic behind everything" -- due_date is a
  // date-only string, and new Date(due_date) < new Date() compared it at
  // UTC midnight against the real instant, so this flipped to "late" up to
  // several hours before the trainee's own centre-local deadline actually
  // passed (same bug class as isEventLive). Compare local date strings
  // instead, same pattern as today-tab.tsx/assignments/page.tsx.
  const timeZone = (await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE;

  // Migration 0302 -- what the candidate attached. Read through an untyped
  // handle until the generated types catch up; RLS is what scopes it.
  const { data: appendixRows } = await (supabase as unknown as SupabaseClient)
    .from("assignment_appendices")
    .select("id, label, file_name, storage_path, link_url, size_bytes, round")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  // An appendix belongs to the round it was attached for, so a resubmission
  // shows what is attached now and a locked first round keeps what it had.
  const appendicesForRound = (r: "first" | "resubmission") =>
    ((appendixRows ?? []) as { round: string }[])
      .filter((a) => a.round === r)
      .map((a) => a as unknown as import("@/app/dashboard/trainee/assignments/[assignmentId]/appendices-block").AppendixRow);
  const today = toLocalIso(new Date(), timeZone);
  const deadlinePassed = Boolean(
    assignment.due_date && round === "first" && !locked && assignment.due_date < today
  );

  // §7 release gating. The assignment is readable from day one; writing opens
  // on the day the course timetable sets it. Staff and the assessor are never
  // gated -- the same carve-out the list makes.
  const clock = trainee.course_id ? await getCourseReleaseClock(supabase, trainee.course_id, today) : null;
  const release = clock?.releaseByType.get(assignment.assignment_type) ?? null;
  const notYetOpen = !isStaff && Boolean(clock) && !clock!.isOpen(assignment.assignment_type);
  const dueDay = clock?.dayOf(assignment.due_date) ?? null;
  const roundStatus = round === "resubmission" ? assignment.resubmission_status : assignment.first_status;
  // A marked round's comments ARE the feedback. Handbook 9.2.2 asks for
  // written feedback "as appropriate", not only when a candidate has to
  // rewrite -- and the marking screen already tells the tutor their overall
  // comment appears on this page, which until now it never did.
  const roundMarked = roundStatus === "approved" || roundStatus === "resubmission_required";
  const tutorOverall = round === "resubmission" ? assignment.resubmission_overall_comment : assignment.first_overall_comment;

  const result = resolveAssignmentResult(assignment);
  const canExportCoverSheet = assignment.first_status === "approved" || assignment.first_status === "resubmission_required";


  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/portfolio/${traineeId}/assignments`} label={"All assignments"} />

      {/* Ramy, 30 Aug 2026: the one signature a trainee could not give.
          Migration 0245 added the columns and the signature ledger listed
          the row, but nothing rendered a control -- so the booklet export
          was gated on a signature with no button behind it. */}
      <AssignmentResultSignature
        assignmentId={assignment.id}
        round={round}
        status={roundStatus}
        failed={resolveAssignmentResult(assignment) === "fail"}
        signedAt={round === "resubmission" ? assignment.resubmission_outcome_signed_at : assignment.first_outcome_signed_at}
        signatureName={
          round === "resubmission" ? assignment.resubmission_outcome_signature_name : assignment.first_outcome_signature_name
        }
        viewerSignatureName={viewer?.signature_name ?? null}
        canSign={!isStaff && viewer?.id === traineeId}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">{ASSIGNMENT_INFO[assignment.assignment_type].title}</h1>
          <p className="mt-1 text-sm text-muted">
            {isStaff
              ? `${ASSIGNMENT_RESULT_LABEL[result]}${round === "resubmission" && roundStatus === "submitted" ? " · resubmission in" : ""}${assignment.first_submitted_late ? " · first submission late" : ""}`
              : assignment.due_date
                ? `Due ${formatCalendarDate(assignment.due_date, { year: "numeric" })}`
                : "No deadline set"}
          </p>
        </div>
        {canExportCoverSheet ? (
          <a
            href={`/api/portfolio/${traineeId}/assignments/${assignmentId}/cover-sheet`}
            className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink trainee-hover-fill"
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

      {assessorCourseId && assignment.due_date ? (
        <p className="text-sm text-muted">Due {formatCalendarDate(assignment.due_date, { year: "numeric" })}</p>
      ) : null}

      {!template ? (
        <div className="sheet p-6">
          <p className="text-muted">
            {isStaff
              ? "This assignment's brief hasn't been published yet."
              : "This assignment's brief hasn't been published yet -- check back soon."}
          </p>
        </div>
      ) : assessorCourseId ? (
        assignment.first_status === "not_submitted" ? (
          <div className="sheet p-6">
            <p className="text-muted">Not yet submitted.</p>
          </div>
        ) : (
          <AssignmentAuthoringForm
            assignmentId={assignment.id}
            title={ASSIGNMENT_INFO[assignment.assignment_type].title}
            sections={template.sections}
            responses={responses ?? []}
            round={round}
            locked
            deadlinePassed={false}
            criteria={criteria.map((c) => ({ key: c.key, text: c.text }))}
            intro={ASSIGNMENT_INFO[assignment.assignment_type].description}
            sanction={assignment.assignment_type === "Plagiarism Reflection"}
            format={template.format}
            tutorOverall={roundMarked ? tutorOverall : null}
            priorOverall={round === "resubmission" ? assignment.first_overall_comment : null}
            showComments={roundMarked}
            appendices={appendicesForRound(round)}
            centerId={trainee.center_id}
            traineeId={traineeId}
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
            title={ASSIGNMENT_INFO[assignment.assignment_type].title}
            sections={template.sections}
            responses={responses ?? []}
            round={round}
            locked={locked}
            deadlinePassed={deadlinePassed}
            criteria={criteria.map((c) => ({
              key: c.key,
              text: c.text,
              mark: (round === "resubmission"
                ? (assignment.first_criteria_marks ?? {})[c.key]
                : null) as "met" | "not_met" | null | undefined,
            }))}
            intro={ASSIGNMENT_INFO[assignment.assignment_type].description}
            sanction={assignment.assignment_type === "Plagiarism Reflection"}
            format={template.format}
            tutorOverall={roundMarked ? tutorOverall : null}
            priorOverall={round === "resubmission" ? assignment.first_overall_comment : null}
            showComments={roundMarked}
            appendices={appendicesForRound(round)}
            centerId={trainee.center_id}
            traineeId={traineeId}
            notYetOpen={notYetOpen}
            opensOnDay={release?.day ?? null}
            opensOnDate={release?.date ?? null}
            dueOnDay={dueDay}
            dueOnDate={assignment.due_date}
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
