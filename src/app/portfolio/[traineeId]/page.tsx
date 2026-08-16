import Link from "next/link";
import { Video, Paperclip } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { deleteBroadcast } from "@/app/portfolio/[traineeId]/stream-actions";
import { TodayTab } from "@/app/portfolio/[traineeId]/today-tab";
import { CandidateStatusCard } from "@/app/portfolio/[traineeId]/withdraw-card";
import { TUTOR_ROLE_LABELS, type TutorRole } from "@/lib/tutor-roles";
import { toLocalIso } from "@/lib/timetable-grid";
import { COURSE_STATUS_LABEL } from "@/lib/course-status";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";
import { DesignerCredit } from "@/components/designer-credit";
import { AssessorMeetingCard } from "./assessor-meeting-card";

const EVENT_TYPE_LABELS: Record<string, string> = {
  input_session: "Input session",
  tp: "Teaching practice",
  assignment_due: "Assignment due",
  resubmission_due: "Resubmission due",
  milestone: "Milestone",
};

// No duration/end-time field exists on either the timetable event or the
// ad-hoc broadcast -- 3 hours is a reasonable upper bound for a single
// CELTA session (TP block, input session) rather than adding a schema
// field for this cosmetic badge.
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

function getZoomStatus(startDate: Date | null): "live" | "upcoming" | null {
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  const now = Date.now();
  const start = startDate.getTime();
  if (now >= start && now <= start + LIVE_WINDOW_MS) return "live";
  if (now < start) return "upcoming";
  return null;
}

// §4 Course Stream -- the default tab behind the portfolio link.
export default async function CourseStreamPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId } = await params;
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select(
      "course_id, course_status, course_status_set_at, course_status_note, withdrawal_reportable, extension_completes_by, special_consideration"
    )
    .eq("id", traineeId)
    .maybeSingle();
  if (!trainee?.course_id) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  // See portfolio/[traineeId]/layout.tsx's previewAsTrainee comment -- same
  // "hide staff-only rendering, never touch real authorization" rule here.
  // No notFound() gate keys off this in this file, so folding preview
  // straight into `isStaff` is safe (unlike TP detail/assignment/CELTA5,
  // which need a separate raw staff check for their access gate).
  const isStaff = (viewer?.role === "trainer" || viewer?.role === "admin") && preview !== "trainee";

  // for-claude-code-trainee-interface.md's Today tab replaces this page's
  // content for a real trainee -- staff/assessor keep Course Stream below,
  // unchanged. A real trainee previewing normally (not staff-in-preview)
  // gets Today even under the peer-observation carve-out (viewing a
  // groupmate's page) -- harmless, every link Today renders still points
  // at traineeId's own routes, each independently guarded already.
  if (!isStaff && !assessorCourseId) {
    const { data: course } = await supabase.from("courses").select("name").eq("id", trainee.course_id).maybeSingle();
    return <TodayTab supabase={supabase} traineeId={traineeId} courseId={trainee.course_id} courseName={course?.name ?? null} />;
  }

  const today = toLocalIso(new Date());

  const [{ data: broadcasts }, { data: timetableEvents }, { data: tutors }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("course_broadcasts")
        .select(
          "*, profiles(full_name, role), course_timetable_events!linked_timetable_event_id(event_date, event_time, zoom_url, title)"
        )
        .eq("course_id", trainee.course_id)
        // Scheduling (migration 0093): a still-pending anchored announcement
        // has sent_at null and must stay invisible to candidates until it
        // actually fires -- see /trainer/announcements for the trainer-side
        // Scheduled panel that shows those.
        .not("sent_at", "is", null)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("course_timetable_events")
        .select("*")
        .eq("course_id", trainee.course_id)
        .gte("event_date", today)
        .order("event_date")
        .order("event_time")
        .limit(4),
      supabase
        .from("profiles")
        .select("full_name, tutor_role")
        .eq("course_id", trainee.course_id)
        .eq("role", "trainer"),
      supabase.from("assignments").select("id, assignment_type").eq("trainee_id", traineeId),
    ]);

  // §1.1a v2 rule 9 -- deadline chips are live links to the assignment card
  // they govern. A timetable event only carries the assignment TYPE
  // (course-wide -- "Focus on the Learner is due", not any one trainee's
  // row), so it's resolved here against this trainee's own assignments.
  const assignmentIdByType = new Map((assignments ?? []).map((a) => [a.assignment_type, a.id]));

  // §3 "Deferral" eligibility -- ">50% of the course completed", surfaced
  // as a warning on the status card, not a hard block (the handbook leaves
  // it to the centre's discretion either way).
  let hoursAttended = 0;
  let totalHours = 120;
  if (isStaff && trainee.course_status === "active") {
    const [{ data: celta5Record }, { data: course }] = await Promise.all([
      supabase.from("celta5_records").select("hours_attended").eq("trainee_id", traineeId).maybeSingle(),
      supabase.from("courses").select("total_hours").eq("id", trainee.course_id).maybeSingle(),
    ]);
    hoursAttended = celta5Record?.hours_attended ?? 0;
    totalHours = course?.total_hours ?? 120;
  }

  // §3 -- once deferred, the frozen transfer record itself is the fuller
  // status detail worth showing (reasons, hours carried, whether it's been
  // linked to a destination course yet), not just the generic status note.
  const { data: courseForVisit } = trainee.course_id
    ? await supabase.from("courses").select("assessor_visit_date").eq("id", trainee.course_id).maybeSingle()
    : { data: null };

  let deferralTransfer: { reasons: string; hours_carried: number; reintegration_deadline: string | null; linked_at: string | null } | null =
    null;
  if (isStaff && trainee.course_status === "deferred") {
    const { data } = await supabase
      .from("deferral_transfers")
      .select("reasons, hours_carried, reintegration_deadline, linked_at")
      .eq("source_trainee_id", traineeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    deferralTransfer = data;
  }

  // Handbook 14.2's candidate-concerns meeting. Only offered to the candidate
  // themselves, and only when a visit is actually scheduled -- a permanent
  // control would read as an invitation to complain, and a tutor viewing the
  // portfolio must never be able to raise or cancel one on someone's behalf.
  const ownVisitDate = !isStaff && trainee.course_id ? (courseForVisit?.assessor_visit_date ?? null) : null;
  const { data: ownMeetingRequest } = ownVisitDate
    ? await supabase
        .from("assessor_meeting_requests")
        .select("id")
        .eq("trainee_id", traineeId)
        .is("withdrawn_at", null)
        .maybeSingle()
    : { data: null };

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-[1fr_300px] lg:grid-rows-[auto_1fr]">
      <div className="flex items-center justify-between lg:col-start-1 lg:row-start-1">
        <h2 className="font-serif text-xl text-ink">Course Stream</h2>
        <p className="text-xs text-muted">{(broadcasts ?? []).length} broadcasts</p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
        {(broadcasts ?? []).length === 0 ? (
          <p className="sheet text-sm text-muted">No broadcasts yet.</p>
        ) : (
          (broadcasts ?? []).map((b) => {
            const author = b.profiles as unknown as { full_name: string; role: string } | null;
            const linkedEvent = b.course_timetable_events as unknown as {
              event_date: string;
              event_time: string | null;
              zoom_url: string | null;
              title: string;
            } | null;
            // A linked timetable event is the live source of truth for the
            // Zoom time -- if the trainer reschedules that event later, this
            // broadcast's displayed time updates with it. Falls back to the
            // broadcast's own ad-hoc fields when there's no link.
            const zoomUrl = linkedEvent?.zoom_url || b.zoom_url;
            const zoomWhen = linkedEvent
              ? [linkedEvent.event_date, linkedEvent.event_time].filter(Boolean).join(" ")
              : b.zoom_time
                ? new Date(b.zoom_time).toLocaleString()
                : null;
            // Only a linked event WITH a time, or an ad-hoc zoom_time, gives
            // an actual instant to compare against -- a date-only linked
            // event (no event_time) has no real start to badge against.
            const zoomStartDate = linkedEvent
              ? linkedEvent.event_time
                ? new Date(`${linkedEvent.event_date}T${linkedEvent.event_time}`)
                : null
              : b.zoom_time
                ? new Date(b.zoom_time)
                : null;
            const zoomStatus = getZoomStatus(zoomStartDate);
            const initials = (author?.full_name ?? "?")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div key={b.id} className="sheet">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                      <span className="text-xs font-semibold text-muted">{initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{author?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted">
                        {[author?.role, new Date(b.created_at).toLocaleString()].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  {b.pinned ? (
                    <span className="pill pill-gold ml-auto">Pinned</span>
                  ) : null}
                </div>

                <p className="mt-2 font-serif text-xl font-semibold text-ink">{b.title}</p>
                {b.body ? <p className="mt-1 text-base whitespace-pre-wrap text-muted">{b.body}</p> : null}

                {zoomUrl ? (
                  <a
                    href={zoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center gap-3 rounded-[6px] border border-primary/25 bg-accent/50 px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <Video className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">Join Zoom session</span>
                        {zoomStatus === "live" ? (
                          <span className="pill pill-danger pill-live">Live now</span>
                        ) : zoomStatus === "upcoming" ? (
                          <span className="pill pill-info">Upcoming</span>
                        ) : null}
                      </span>
                      {zoomWhen ? <span className="block text-xs text-muted">{zoomWhen}</span> : null}
                    </span>
                    <span className="text-sm font-medium text-primary">Open</span>
                  </a>
                ) : null}

                {b.attachment_url ? (
                  <a
                    href={b.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sheet-interactive mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
                    {b.attachment_name ?? "Attachment"}
                  </a>
                ) : null}

                {isStaff ? (
                  <form action={deleteBroadcast} className="mt-3">
                    <input type="hidden" name="broadcast_id" value={b.id} />
                    <button type="submit" className="text-xs text-destructive hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="sheet-accent h-fit">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">This week</p>
            {(timetableEvents ?? []).length > 0 ? (
              <ul className="mt-3 flex flex-col">
                {(timetableEvents ?? []).map((event, i) => {
                  const assignmentId = event.linked_assignment_type
                    ? assignmentIdByType.get(event.linked_assignment_type as AssignmentTypeValue)
                    : undefined;
                  return (
                    <li
                      key={event.id}
                      className={`py-3 ${i > 0 ? "border-t border-border" : "pt-0"}`}
                    >
                      {assignmentId ? (
                        <Link
                          href={`/portfolio/${traineeId}/assignments/${assignmentId}`}
                          className="text-sm font-semibold text-ink hover:text-primary hover:underline"
                        >
                          {event.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-ink">{event.title}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted">
                        {[EVENT_TYPE_LABELS[event.type], event.event_date, event.event_time].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing scheduled yet.</p>
            )}
          </div>

          <div className="sheet-accent h-fit">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Course tutors</p>
            {(tutors ?? []).length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {(tutors ?? []).map((tutor, i) => (
                  <li key={i} className="text-sm text-ink">
                    {tutor.full_name}
                    <span className="ml-1 text-xs text-muted">
                      {(tutor.tutor_role && TUTOR_ROLE_LABELS[tutor.tutor_role as TutorRole]) || "Trainer"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No tutors assigned yet.</p>
            )}
          </div>

          {isStaff && trainee.course_status === "active" ? (
            <CandidateStatusCard
              traineeId={traineeId}
              specialConsideration={trainee.special_consideration}
              hoursAttended={hoursAttended}
              totalHours={totalHours}
            />
          ) : isStaff && trainee.course_status !== "active" ? (
            <div className="sheet-accent h-fit">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Candidate status</p>
              <p className="mt-2 text-sm font-semibold text-ink">{COURSE_STATUS_LABEL[trainee.course_status]}</p>
              {trainee.course_status_set_at ? (
                <p className="mt-0.5 text-xs text-muted">
                  Set {new Date(trainee.course_status_set_at).toLocaleDateString()}
                </p>
              ) : null}
              {trainee.course_status === "withdrawn" ? (
                <p className="mt-1 text-xs text-muted">
                  {trainee.withdrawal_reportable
                    ? "Reportable -- entry form was already sent."
                    : "Internal only -- withdrawn before the entry form was sent."}
                </p>
              ) : null}
              {trainee.course_status === "extension" ? (
                <p className="mt-1 text-xs text-muted">
                  Portfolio stays active. {trainee.extension_completes_by ? `Expected completion: ${trainee.extension_completes_by}.` : ""} Close-out should wait for them.
                </p>
              ) : null}
              {trainee.course_status === "deferred" && deferralTransfer ? (
                <div className="mt-1 flex flex-col gap-1 text-xs text-muted">
                  <p>&ldquo;{deferralTransfer.reasons}&rdquo;</p>
                  <p>{deferralTransfer.hours_carried.toFixed(1)} hours carried.</p>
                  {deferralTransfer.reintegration_deadline ? <p>Re-integrate by {deferralTransfer.reintegration_deadline}.</p> : null}
                  <p className="font-semibold text-ink">
                    {deferralTransfer.linked_at ? "Linked to a destination course." : "Not yet linked to a destination course."}
                  </p>
                </div>
              ) : null}
              {trainee.course_status === "restarting" ? (
                <p className="mt-1 text-xs text-muted">Not yet linked to a destination course &mdash; link it from that course&apos;s admin page once they join.</p>
              ) : null}
              {trainee.course_status_note ? (
                <p className="mt-2 text-xs text-muted italic">&ldquo;{trainee.course_status_note}&rdquo;</p>
              ) : null}
              {trainee.course_status === "withdrawn" ? (
                <a
                  href={`/api/withdrawal-letter/${traineeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  Download withdrawal letter →
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {ownVisitDate ? (
        <div className="lg:col-start-2">
          <AssessorMeetingCard
            traineeId={traineeId}
            visitDate={new Date(`${ownVisitDate}T00:00:00`).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
            })}
            alreadyRequested={Boolean(ownMeetingRequest)}
          />
        </div>
      ) : null}

      <DesignerCredit />
    </div>
  );
}
