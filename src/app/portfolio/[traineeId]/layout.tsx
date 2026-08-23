import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { Eye } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { PortfolioTabs } from "@/app/portfolio/[traineeId]/portfolio-tabs";
import { TraineeTopNav } from "@/app/portfolio/[traineeId]/trainee-top-nav";
import { TraineeMobileNav } from "@/app/portfolio/[traineeId]/trainee-mobile-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { computeCourseDayProgress } from "@/lib/course-day";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import {
  CELTA_CRITERIA_CODES,
  computeCriteriaPct,
  computeCriteriaSuggestion,
  computeTrajectory,
  type Trajectory,
} from "@/lib/celta-criteria";
import { HideDuringPreview, TraineeEyebrowLabel, PreviewBanner, ChatDrawerSwitcher } from "@/app/portfolio/[traineeId]/preview-chrome";
import { STANDING_LABEL } from "@/components/trajectory-gradient-bar";
import { computeQuietHoursNote } from "@/lib/timetable-grid";
import { COURSE_STATUS_LABEL, isCourseStatusReadOnly } from "@/lib/course-status";
import { getPeerGroupMembers } from "@/lib/peer-observation";

// §3 -- shared shell for every /portfolio/:traineeId/* tab. A trainee can
// only ever land on their own :traineeId (redirected home otherwise);
// trainers/admins can open any trainee's portfolio from the roster. The
// underlying trainee/course fetch below relies on existing RLS to enforce
// that a trainer/admin can only reach trainees in their own course/center --
// if RLS denies the row, `trainee` comes back null and we 404, so there's
// no separate authorization check to duplicate here.
// §11 -- an assessor (no real session, token cookie only) reaches this same
// shell read-only, scoped to their token's course_id -- RLS has no
// auth.uid() to key off for them at all, so their branch uses the admin
// client with that course_id as the explicit authorization check instead.
export default async function PortfolioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;

  // specs/build-spec.md "Peer observation" -- the one legitimate reason a
  // trainee reaches a URL that isn't their own: they're one of the other
  // five in that candidate's TP group, viewing a /tp/[tpNumber] page to
  // read prompts or write notes. Every OTHER subpage under this layout
  // (assignments, celta5, pre-course-task) independently guards with its
  // own viewer.id !== traineeId check, so relaxing the redirect here can't
  // leak anything those pages don't already protect on their own -- only
  // Course Stream has no such check, and it shows course-wide broadcasts,
  // not this trainee's private data, so that's fine either way.
  if (viewer?.role === "trainee" && viewer.id !== traineeId) {
    const admin = createAdminClient();
    const group = await getPeerGroupMembers(admin, traineeId);
    if (!group.some((m) => m.traineeId === viewer.id)) {
      redirect(`/portfolio/${viewer.id}`);
    }
  }

  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", traineeId)
    .eq("role", "trainee")
    .maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const isStaffView = isStaff || Boolean(assessorCourseId);
  // for-claude-code-trainee-interface.md's top nav replaces the sidebar only
  // for a real candidate viewing their own (or, via the peer-observation
  // carve-out above, a groupmate's) portfolio -- staff/assessor keep the
  // existing PortfolioTabs sidebar, a deliberately different tool for
  // browsing one candidate's whole record rather than a daily briefing.
  const showTraineeNav = !isStaffView;

  const courseDayProgress = trainee.course_id ? await computeCourseDayProgress(supabase, trainee.course_id) : null;
  const traineeInitials = trainee.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // §1.1d: the "Preview as trainee" button promises a real preview
  // of what the candidate sees -- confirmed live it wasn't actually doing
  // that (the broadcast composer, trajectory pill etc. all still rendered,
  // since every page independently re-derives isStaff from the real
  // session role, and this layout can't read ?preview=trainee server-side
  // at all -- Next.js never passes searchParams to a layout). The pages
  // under this layout DO receive searchParams and fold `preview=trainee`
  // straight into their own isStaff-equivalent for real UI gating; this
  // layout's own staff-only chrome (trajectory pill, chat drawer, eyebrow
  // label) is still fetched/computed normally below but conditionally
  // RENDERED via the small client components in preview-chrome.tsx, which
  // read the param client-side instead. Every server action still calls
  // requireRole("trainer") itself regardless of any of this, so none of it
  // can be used to bypass a real authorization check either way.
  const staffChat =
    viewer?.role === "trainee" || viewer?.role === "trainer" ? await getInitialStaffChatData(viewer.id) : null;
  // A staff member's OWN chat (above) isn't part of what a trainee actually
  // sees, so previewing showed nothing at all -- confirmed live, "messages
  // do not appear anywhere on the trainee view." Real trainees do have
  // their own chat (TP-group channel + DM-their-tutor, 0041), so fetch the
  // TARGET trainee's channels too whenever staff might preview this page,
  // and let the client-side preview toggle (chat-preview.tsx) pick which
  // one to render. getInitialStaffChatData is keyed purely by profileId, no
  // role branching inside it, so calling it with the trainee's id is safe
  // and returns exactly what that trainee's own session would see.
  const traineePreviewChat = isStaff ? await getInitialStaffChatData(trainee.id, createAdminClient()) : null;
  // Same RLS boundary, different code path: MessageThread's own client-side
  // fetch (for the latest-message preview above the compose row) runs
  // under the REAL browser session -- staff's, not the trainee's -- so it
  // silently came back empty too, even though this channel genuinely has
  // messages (confirmed live: "the one you created for the trainee...
  // that extra bit on top is not there" -- not because no one wrote
  // anything). Fetch the trainee's primary channel's latest message here,
  // admin-side, and hand it to MessageThread as a static value instead of
  // letting it try (and fail) to fetch this itself.
  const traineePreviewLatestMessage = traineePreviewChat?.channels[0]
    ? (
        await createAdminClient()
          .from("staff_messages")
          .select("*")
          .eq("channel_id", traineePreviewChat.channels[0].id)
          .order("created_at", { ascending: false })
          .limit(1)
      ).data?.[0]
    : null;

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: center },
    { data: lessons },
    { data: assignments },
    { data: preCourseSections },
    { data: preCourseResponses },
    { data: todaysEvents },
  ] = await Promise.all([
    supabase.from("centers").select("*").eq("id", trainee.center_id).maybeSingle(),
    supabase.from("tp_lessons").select("id").eq("trainee_id", trainee.id),
    supabase.from("assignments").select("first_status, resubmission_status").eq("trainee_id", trainee.id),
    supabase.from("pre_course_task_sections").select("id").eq("center_id", trainee.center_id),
    supabase.from("pre_course_task_responses").select("section_id, response").eq("trainee_id", trainee.id),
    trainee.course_id
      ? supabase
          .from("course_timetable_events")
          .select("event_time")
          .eq("course_id", trainee.course_id)
          .eq("event_date", today)
      : Promise.resolve({ data: [] }),
  ]);
  const quietHoursNote = computeQuietHoursNote((todaysEvents ?? []).map((e) => e.event_time), new Date());

  const tpsTaught = (lessons ?? []).length;
  const assignmentsPassed = (assignments ?? []).filter(
    (a) => a.first_status === "approved" || a.resubmission_status === "approved"
  ).length;
  const preCourseTotal = preCourseSections?.length ?? 0;
  const preCourseAnswered = (preCourseResponses ?? []).filter((r) => r.response && r.response.trim() !== "").length;

  // Trajectory: trainer/assessor-only informal estimate, computed the exact
  // same way the CELTA5 page does (tutor's Stage Two ratings, falling back
  // to the same TP-feedback-tag suggestion when a criterion isn't rated
  // yet) -- gated behind isStaffView so a trainee view never pays for or
  // sees this query at all.
  let trajectory: Trajectory | null = null;
  // Sidebar's "CELTA 5 / N%" meta -- reuses this same isStaffView-gated
  // matrix fetch (kept blank for a trainee's own view rather than adding a
  // second, RPC-based fetch path just for this one meta count; the
  // trainee's real celta5 tab already has its own correct, RLS-safe query).
  let criteriaPctMeta = "";
  if (isStaffView) {
    const lessonIds = (lessons ?? []).map((l) => l.id);
    const [{ data: matrix }, { data: criteriaTags }] = await Promise.all([
      supabase.from("celta5_matrix").select("criteria_code, tutor_status_stage2").eq("trainee_id", trainee.id),
      lessonIds.length > 0
        ? supabase.from("tp_lesson_criteria_tags").select("*").in("tp_lesson_id", lessonIds).order("created_at")
        : Promise.resolve({ data: [] }),
    ]);

    const matrixByCode = new Map((matrix ?? []).map((m) => [m.criteria_code, m.tutor_status_stage2]));
    const tagsByCriteria = new Map<string, { tag_type: "strength" | "action_point"; created_at: string }[]>();
    for (const tag of criteriaTags ?? []) {
      const list = tagsByCriteria.get(tag.criteria_code) ?? [];
      list.push({ tag_type: tag.tag_type, created_at: tag.created_at });
      tagsByCriteria.set(tag.criteria_code, list);
    }
    const trajectoryInputs = CELTA_CRITERIA_CODES.map(
      (code) => matrixByCode.get(code) ?? computeCriteriaSuggestion(tagsByCriteria.get(code) ?? []) ?? null
    );
    trajectory = computeTrajectory(trajectoryInputs);
    criteriaPctMeta = `${computeCriteriaPct(matrixByCode)}%`;
  }

  const assignmentsLeft = Math.max((assignments ?? []).length - assignmentsPassed, 0);
  const sidebarMeta = {
    courseStream: "",
    preCourseTask: preCourseTotal > 0 ? `${preCourseAnswered}/${preCourseTotal}` : "",
    resourceHub: "",
    tp: `${tpsTaught}/8`,
    assignments: assignmentsLeft > 0 ? `${assignmentsLeft} due` : "",
    celta5: criteriaPctMeta,
    // for-claude-code-progress-tab-build.md -- no read-tracking to derive a
    // real count from yet, same "" rule already applied to courseStream/
    // resourceHub above rather than fabricating one.
    progress: "",
  };

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Checkpoint 2 (App Redesign.dc.html 1d) -- collapses the old 2-block
          header (14px wordmark bar + a separate .sheet identity block with
          avatar/3 StatBars/trajectory pill) into one 56px bar: back-link +
          name + trajectory-status pill on the left, "Preview as trainee" on
          the right. Attendance hours (previously a StatBar) has no slot in this
          layout and isn't shown here any more -- still visible on the
          roster table and Today's "Needs you" alerts. */}
      {showTraineeNav ? <InstallPrompt /> : null}

      <div className="border-b border-border bg-card">
        {showTraineeNav ? (
          // for-claude-code-trainee-interface.md's header: wordmark left, nav
          // center, "Day N of 20" + initials avatar right.
          <div className="container flex h-14 items-center justify-between gap-4">
            <Link href={`/portfolio/${trainee.id}`} className="shrink-0 block">
              <Wordmark size="header" />
            </Link>
            <TraineeTopNav traineeId={trainee.id} />
            <div className="flex shrink-0 items-center gap-3">
              {courseDayProgress ? (
                <span className="text-xs font-medium text-muted">
                  Day {courseDayProgress.currentDay} of {courseDayProgress.totalDays}
                </span>
              ) : null}
              <div className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-accent">
                <span className="text-[10px] font-semibold text-primary">{traineeInitials}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="container flex h-14 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/trainer/roster" className="shrink-0 text-sm text-primary">
                ← Roster
              </Link>
              <span className="h-5 w-px shrink-0 bg-border" />
              <h1 className="truncate font-serif text-[17px] text-ink">{trainee.full_name}</h1>
              {isCourseStatusReadOnly(trainee.course_status) ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/12 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  {COURSE_STATUS_LABEL[trainee.course_status]}
                </span>
              ) : trainee.course_status === "extension" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  Extension
                </span>
              ) : null}
              {trajectory ? (
                <HideDuringPreview>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-status-warning-bg px-2.5 py-0.5 text-[11px] font-semibold text-status-warning-text">
                    <span className="size-1.5 shrink-0 rounded-full bg-current" />
                    Tracking {STANDING_LABEL[trajectory]}
                  </span>
                </HideDuringPreview>
              ) : null}
              {trainee.special_consideration ? (
                <HideDuringPreview>
                  <span
                    title={trainee.special_consideration}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-ink"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-current" />
                    Special consideration declared
                  </span>
                </HideDuringPreview>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <TraineeEyebrowLabel isStaff={isStaff} readOnly={Boolean(assessorCourseId)} />
              {/* Replaces the retired global ViewSwitcherPill (Ramy, 2026-08-16):
                  candidate preview is a per-candidate action on that candidate's
                  own screen, not an app-wide toggle. Same ?preview=trainee URL
                  the pill already built -- the preview machinery and its own
                  "Exit preview" banner are unchanged. Wrapped in HideDuringPreview
                  so it doesn't sit there offering to enter a mode you're in. */}
              {isStaff ? (
                <HideDuringPreview>
                  <Link
                    href={`/portfolio/${trainee.id}?preview=trainee`}
                    className="flex shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-ink hover:border-primary"
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    Preview as trainee
                  </Link>
                </HideDuringPreview>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {isCourseStatusReadOnly(trainee.course_status) ? (
        <div className="bg-destructive/8 border-b border-destructive/20">
          <div className="container flex h-9 items-center text-xs text-destructive">
            {COURSE_STATUS_LABEL[trainee.course_status]} -- this portfolio is kept as a record but is
            read-only going forward.
          </div>
        </div>
      ) : null}

      <PreviewBanner traineeId={trainee.id} traineeName={trainee.full_name} />

      <div className="container flex flex-1 gap-8 py-8">
        {showTraineeNav ? null : <PortfolioTabs traineeId={trainee.id} meta={sidebarMeta} />}
        <div className="frame min-w-0 flex-1 p-6">{children}</div>
      </div>

      <footer className={`mt-auto py-8 text-center text-xs text-muted ${showTraineeNav ? "pb-20 md:pb-8" : ""}`}>
        {[center?.name, center ? `Cambridge CELTA (Centre ${center.center_number})` : null, `Workspace link ${trainee.id.slice(0, 8)}`]
          .filter(Boolean)
          .join(" · ")}
      </footer>

      {showTraineeNav ? <TraineeMobileNav traineeId={trainee.id} /> : null}

      <ChatDrawerSwitcher
        staffProfileId={viewer?.id ?? null}
        staffChat={staffChat}
        traineeId={trainee.id}
        traineePreviewChat={traineePreviewChat}
        traineePreviewLatestMessage={traineePreviewLatestMessage}
        quietHoursNote={viewer?.role === "trainee" ? quietHoursNote : null}
        raiseForMobileNav={showTraineeNav}
      />
    </div>
  );
}
