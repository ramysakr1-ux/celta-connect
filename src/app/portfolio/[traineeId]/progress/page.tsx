import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { computeObservationHours, OBSERVATION_HOURS_REQUIRED } from "@/lib/observation-hours";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { SelfAssessmentForm } from "@/app/dashboard/trainee/celta5/self-assessment-form";
import { ObservationForm } from "@/app/dashboard/trainee/celta5/observation-form";
import { ObservationTaskForm } from "@/app/portfolio/[traineeId]/celta5/observation-task-form";

// specs/for-claude-code-progress-tab-build.md -- a fresh, independent
// implementation (deliberately NOT extracted from celta5/page.tsx, see that
// spec's "Architecture decision" section: the self-assessment/hours/sign-off
// blocks there are interleaved inline with the ~900-line criteria matrix,
// and surgically pulling JSX out of the most load-bearing page in the app
// for a pure code-organization change isn't worth the regression risk).
// Some query logic is duplicated with celta5/page.tsx's trainee branch --
// an accepted tradeoff per that same spec.
//
// Trainee-self only. get_my_celta5_record() is an auth.uid()-scoped RPC --
// it can't be called "as" another user, so there's no honest way to build a
// staff/assessor read-only mirror of this page the way other portfolio tabs
// do (same reasoning celta5/page.tsx already applies to its own preview=
// trainee case). Staff/assessor viewers get a pointer to CELTA 5 instead of
// a faked view.
export default async function ProgressPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  if (viewer && !isStaff && viewer.id !== traineeId) notFound();

  if (!viewer || viewer.id !== traineeId) {
    return (
      <div className="sheet p-6 text-sm text-muted">
        Progress is the candidate&apos;s own self-assessment and hours log -- check CELTA 5 for the equivalent
        record-level information.
      </div>
    );
  }

  const supabase = await createClient();

  const [
    { data: recordRows },
    { data: observations },
    { data: course },
    { data: obsTasks },
    { data: obsTaskSubmissions },
    { data: tutorialInvites },
    { data: peerNotes },
  ] = await Promise.all([
    supabase.rpc("get_my_celta5_record"),
    supabase.from("observations").select("*").eq("trainee_id", traineeId).order("observation_date"),
    viewer.course_id
      ? supabase.from("courses").select("delivery_mode").eq("id", viewer.course_id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer.course_id
      ? supabase.from("observation_tasks").select("id, title, instructions").eq("course_id", viewer.course_id).order("created_at")
      : Promise.resolve({ data: [] }),
    supabase.from("observation_task_submissions").select("task_id, response, submitted_at").eq("trainee_id", traineeId),
    supabase.from("individual_tutorial_invites").select("stage, timetable_event_id, confirmed_at").eq("trainee_id", traineeId),
    supabase.from("peer_observation_notes").select("sheet_id, submitted_at").eq("observer_id", traineeId).not("submitted_at", "is", null),
  ]);
  const record = recordRows?.[0];
  if (!record) {
    return <div className="sheet p-6 text-sm text-muted">No CELTA 5 record found yet. Check with your trainer.</div>;
  }
  const submissionByTaskId = new Map((obsTaskSubmissions ?? []).map((s) => [s.task_id, s]));

  const stage1Invite = (tutorialInvites ?? []).find((i) => i.stage === "stage1");
  const stage3Invite = (tutorialInvites ?? []).find((i) => i.stage === "stage3");
  const tutorialEventIds = [stage1Invite?.timetable_event_id, stage3Invite?.timetable_event_id].filter((id): id is string => !!id);
  const { data: tutorialEvents } =
    tutorialEventIds.length > 0
      ? await supabase.from("course_timetable_events").select("id, event_date").in("id", tutorialEventIds)
      : { data: [] };
  const tutorialEventById = new Map((tutorialEvents ?? []).map((e) => [e.id, e]));

  const stage2BlockIds = viewer.course_id
    ? (await supabase.from("stage2_tutorial_blocks").select("id").eq("course_id", viewer.course_id)).data?.map((b) => b.id) ?? []
    : [];
  const { data: myStage2Slot } =
    stage2BlockIds.length > 0
      ? await supabase
          .from("stage2_tutorial_slots")
          .select("position, booked_at")
          .in("block_id", stage2BlockIds)
          .eq("trainee_id", traineeId)
          .not("booked_at", "is", null)
          .maybeSingle()
      : { data: null };

  // Same "candidate's own final sign-off, not just the tutor's release"
  // distinction as celta5/page.tsx -- see that file's identical comment.
  const stage2Submitted = !!record.stage2_candidate_submitted_at;
  const stage1And2Released = !!record.stage2_completed_at;
  const bothSigned = !!record.trainee_signoff_stage2_at;

  // Peer observation has no duration field of its own -- each submitted
  // note represents one full TP round observed, hours derived from the
  // real TP length rather than fabricated. Same derivation as celta5/page.tsx.
  const peerSheetsObserved = new Set((peerNotes ?? []).map((n) => n.sheet_id)).size;
  const peerHours = (peerSheetsObserved * TP_LESSON_LENGTH_MINUTES) / 60;
  const { liveHours: experiencedTeacherHours, filmedHours } = computeObservationHours(observations ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Progress</p>
        <h1 className="mt-1 font-serif text-2xl text-ink">Self-assessment, observation hours, and sign-off</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sheet flex flex-col gap-3 border-t-[3px] border-t-[oklch(38%_0.085_155)]">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Stage 1 / 2 / 3</p>
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border-faint py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink">Stage 1 report</p>
                <p className="mt-0.5 text-xs text-muted">
                  {record.stage1_completed_at
                    ? "Filed by your tutor · the tutorial itself is optional, not held up on this"
                    : stage1Invite
                      ? `Tutorial ${stage1Invite.confirmed_at ? "confirmed" : "invited, not yet confirmed"}${
                          tutorialEventById.get(stage1Invite.timetable_event_id) ? ` · ${tutorialEventById.get(stage1Invite.timetable_event_id)!.event_date}` : ""
                        } -- the report itself isn't filed yet`
                      : "Not yet filed"}
                </p>
              </div>
              <span className={`pill ${record.stage1_completed_at ? "pill-success" : "pill-warning"}`}>
                {record.stage1_completed_at ? "Filed" : "Not filed"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-border-faint py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink">Stage 2 tutorial</p>
                <p className="mt-0.5 text-xs text-muted">
                  {myStage2Slot
                    ? `You booked ${myStage2Slot.position === 1 ? "1st" : myStage2Slot.position === 2 ? "2nd" : myStage2Slot.position === 3 ? "3rd" : `${myStage2Slot.position}th`}`
                    : "Book your slot from the timetable"}
                </p>
              </div>
              <span className={`pill ${myStage2Slot ? "pill-success" : "pill-warning"}`}>{myStage2Slot ? "Booked" : "Not booked"}</span>
            </div>
            <div className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink">Stage 3 report</p>
                <p className="mt-0.5 text-xs text-muted">
                  {record.stage3_required
                    ? record.stage3_finalized_at
                      ? "Filed by your tutor"
                      : stage3Invite
                        ? `Tutorial ${stage3Invite.confirmed_at ? "confirmed" : "invited, not yet confirmed"}${
                            tutorialEventById.get(stage3Invite.timetable_event_id) ? ` · ${tutorialEventById.get(stage3Invite.timetable_event_id)!.event_date}` : ""
                          }`
                        : "Triggered -- not yet filed"
                    : "Only filed if triggered -- not-to-standard at Stage 2, slipping from above-standard, or a failed assignment"}
                </p>
              </div>
              <span className={`pill ${!record.stage3_required ? "pill-neutral" : record.stage3_finalized_at ? "pill-success" : "pill-warning"}`}>
                {!record.stage3_required ? "N/A so far" : record.stage3_finalized_at ? "Filed" : "Pending"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted">Sourced from the same Standing table your tutor sees -- this is your own row, not a separate record.</p>
        </div>

        <div className="sheet flex flex-col gap-3 border-t-[3px] border-t-[oklch(42%_0.13_27)]">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">CELTA 5 self-assessment</p>
          <div className="flex flex-col gap-1">
            <p className={`text-sm font-semibold ${bothSigned ? "text-ink" : stage2Submitted ? "text-primary" : "text-status-warning-text"}`}>
              {bothSigned ? "Both signed" : stage2Submitted ? "Candidate signed" : "Not started"}
            </p>
            <p className="text-xs text-muted">
              {bothSigned
                ? "Signed off by you and your tutor."
                : stage2Submitted
                  ? stage1And2Released
                    ? "Your tutor has released the matrix -- review it below and sign off."
                    : "Submitted -- your tutor is reviewing it."
                  : "Best completed after TP2, once you have some feedback to reflect on."}
            </p>
          </div>
          <p className="text-xs text-muted">You sign, then your tutor countersigns -- neither alone finishes it.</p>
          <p className="text-[11px] text-muted">No grade lives here. This is your own reflection against the five CELTA components, not an assessment.</p>
        </div>

        <div className="sheet flex flex-col gap-3 border-t-[3px] border-t-[oklch(38%_0.085_155)]">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Observation hours</p>
          <div className="flex flex-col">
            <div className="flex items-start gap-3 border-b border-border-faint py-2.5">
              <span className="w-9 shrink-0 text-sm font-semibold text-ink">{experiencedTeacherHours.toFixed(1)}h</span>
              <p className="text-xs text-muted">
                of {OBSERVATION_HOURS_REQUIRED}h minimum, experienced teachers{experiencedTeacherHours >= OBSERVATION_HOURS_REQUIRED ? " -- complete" : ""}
              </p>
            </div>
            <div className="flex items-start gap-3 border-b border-border-faint py-2.5">
              <span className="w-9 shrink-0 text-sm font-semibold text-ink">{peerHours.toFixed(1)}h</span>
              <p className="text-xs text-muted">peer observation, live only</p>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-9 shrink-0 text-sm font-semibold text-ink">{filmedHours.toFixed(1)}h</span>
              <p className="text-xs text-muted">filmed, capped separately -- does not count toward the peer minimum</p>
            </div>
          </div>
          <p className="text-[11px] text-muted">Full log below -- every entry ties back to a specific session.</p>
        </div>
      </div>

      {!stage2Submitted ? (
        <div>
          <h3 className="font-serif text-lg text-ink">Progress Record — Stage 2: self-assessment</h3>
          <div className="mt-3">
            <SelfAssessmentForm />
          </div>
        </div>
      ) : (
        // The released matrix, the sign-off button itself, Stage 3's tutor
        // assessment, and the final report download all still live on
        // celta5/page.tsx (not duplicated here per for-claude-code-progress-
        // tab-build.md's architecture decision) -- this is the pointer to
        // them once there's actually something to review or sign.
        <div className="sheet flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {bothSigned
              ? "Signed off. Your released matrix, Stage 3 assessment (if triggered), and final report live on CELTA 5."
              : stage1And2Released
                ? "Your tutor has released the matrix -- review it and sign off on CELTA 5."
                : "Submitted -- your tutor is reviewing it. The released matrix will appear on CELTA 5."}
          </p>
          <Link href={`/portfolio/${traineeId}/celta5`} className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainee-hover">
            Open CELTA 5 →
          </Link>
        </div>
      )}

      {(obsTasks ?? []).length > 0 ? (
        <div>
          <h3 className="font-serif text-lg text-ink">Observation tasks</h3>
          <p className="mt-1 text-sm text-muted">
            Directed observations your tutor has assigned -- submitting one also counts toward your 6-hour
            requirement below.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {(obsTasks ?? []).map((task) => {
              const submission = submissionByTaskId.get(task.id);
              return (
                <div key={task.id} className="sheet">
                  <p className="font-medium text-ink">{task.title}</p>
                  <p className="mt-1 text-sm text-muted">{task.instructions}</p>
                  {submission ? (
                    <div className="mt-3 border-t border-border-faint pt-3">
                      <p className="text-xs text-muted">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{submission.response}</p>
                    </div>
                  ) : (
                    <ObservationTaskForm taskId={task.id} deliveryMode={course?.delivery_mode ?? undefined} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="font-serif text-lg text-ink">Observations of experienced teachers</h3>
        <p className="mt-1 text-sm text-muted">Log the 6 hours you spend observing experienced teachers (up to 3 filmed).</p>
        {course?.delivery_mode === "mixed"
          ? (() => {
              const hasF2f = (observations ?? []).some((o) => o.mode === "f2f");
              const hasOnline = (observations ?? []).some((o) => o.mode === "online");
              const covered = hasF2f && hasOnline;
              return (
                <p className={`mt-1 text-sm ${covered ? "text-primary" : "text-status-warning-text"}`}>
                  Mixed-mode course: your observations should cover both face-to-face and online teaching.{" "}
                  {covered
                    ? "Both modes logged."
                    : !hasF2f && !hasOnline
                      ? "Neither mode logged yet."
                      : !hasF2f
                        ? "Face-to-face not logged yet."
                        : "Online not logged yet."}
                </p>
              );
            })()
          : null}
        <div className="mt-3 flex flex-col gap-3">
          {observations?.map((o) => (
            <ObservationForm key={`${o.id}-${o.updated_at}`} observation={o} deliveryMode={course?.delivery_mode ?? undefined} />
          ))}
          <ObservationForm deliveryMode={course?.delivery_mode ?? undefined} />
        </div>
      </div>
    </div>
  );
}
