import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { responseIsAnswered } from "@/lib/pre-course-task-shape";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId, getPortfolioTrainee } from "@/lib/auth/portfolio-access";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { Eye } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { PortfolioTabs } from "@/app/portfolio/[traineeId]/portfolio-tabs";
import { TraineeSidebarNav } from "@/app/portfolio/[traineeId]/trainee-sidebar-nav";
import { TraineeNameBanner } from "@/app/portfolio/[traineeId]/trainee-name-banner";
import { TraineeHeaderCorner } from "@/app/portfolio/[traineeId]/trainee-header-corner";
import { TraineeMobileNav } from "@/app/portfolio/[traineeId]/trainee-mobile-nav";
import { computeWeekOf } from "@/lib/course-progress";
import { InstallPrompt } from "@/components/install-prompt";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { markScavengerHuntFound } from "@/lib/scavenger-hunt";
import {
  CELTA_CRITERIA_CODES,
  computeCriteriaPct,
  computeCriteriaSuggestion,
  computeTrajectory,
  type Trajectory,
} from "@/lib/celta-criteria";
import { PortfolioFocusRow } from "@/app/portfolio/[traineeId]/focus-row";
import { HideDuringPreview, TraineeEyebrowLabel, PreviewBanner, ChatDrawerSwitcher } from "@/app/portfolio/[traineeId]/preview-chrome";
import { STANDING_LABEL } from "@/components/trajectory-gradient-bar";
import { computeQuietHoursNote, toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { COURSE_STATUS_LABEL, isCourseStatusReadOnly } from "@/lib/course-status";
import { getPeerGroupMembers } from "@/lib/peer-observation";
import { computeCourseDayProgress } from "@/lib/course-day";

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
  const trainee = await getPortfolioTrainee(traineeId);
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const isStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const isStaffView = isStaff || Boolean(assessorCourseId);

  // Ramy, 28 Aug 2026: "the logic behind everything" -- fetched once here
  // (rather than inside the Promise.all further down, where it used to
  // live) so its timezone is available for BOTH "today" computations below,
  // not just the later one. Both used to be new Date().toISOString(),
  // UTC's own date -- wrong for any centre off UTC (the app default is
  // Europe/Istanbul, GMT+3) for the few hours a day the two disagree.
  const center = await getCachedCenter(trainee.center_id);
  const timeZone = center?.time_zone ?? DEFAULT_TIMEZONE;

  // Scavenger hunt Q6 ("What is today's course day counter showing, right
  // now?") -- the counter renders in this same layout's header on every
  // page, so any real visit by the trainee themselves resolves it, not a
  // specific destination page the way the other five questions each have.
  //
  // Which means a candidate is at 1/6 the moment they first sign in,
  // before hunting for anything. Reviewed 28 Aug 2026 and deliberately
  // kept. Making it cost effort would need a manual "mark as found"
  // control, which the spec rules out ("not a form to fill in, it's an
  // instrumented tour"). And it does useful work as-is: nothing on the
  // panel tells a candidate there is no button to press, so one row
  // resolving on arrival demonstrates the rule -- these resolve as you
  // explore -- where a blank 0/6 would send them looking for a control
  // that does not exist.
  if (viewer?.role === "trainee" && viewer.id === traineeId && trainee.course_id) {
    await markScavengerHuntFound(supabase, trainee.course_id, traineeId, "day_counter");
  }
  // for-claude-code-trainee-interface.md's top nav replaces the sidebar only
  // for a real candidate viewing their own (or, via the peer-observation
  // carve-out above, a groupmate's) portfolio -- staff/assessor keep the
  // existing PortfolioTabs sidebar, a deliberately different tool for
  // browsing one candidate's whole record rather than a daily briefing.
  const showTraineeNav = !isStaffView;

  const traineeInitials = trainee.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // TraineeNameBanner's own "week N" -- only fetched for the showTraineeNav
  // branch's landing page, same course_id already used above. Ramy,
  // 2026-08-24: just the week number now, no weekday and no "of M" -- the
  // real date already shows in Today's own heading below.
  let bannerWeekNumber: number | null = null;
  if (showTraineeNav && trainee.course_id) {
    const { data: courseDates } = await supabase.from("courses").select("start_date, end_date").eq("id", trainee.course_id).maybeSingle();
    const today = toLocalIso(new Date(), timeZone);
    const weekOf = courseDates?.start_date && courseDates?.end_date ? computeWeekOf(courseDates.start_date, courseDates.end_date, today) : null;
    bannerWeekNumber = weekOf ? Number(weekOf.match(/week (\d+)/)?.[1]) || null : null;
  }

  // specs/for-claude-code-trainee-interface.md §"Header": "Day N of 20"
  // course-day counter, right side, next to the avatar -- computeCourseDayProgress
  // already existed (built for the FOL spot-check page's own Day N language)
  // but was never actually called from the trainee header itself, so the
  // spec's counter never rendered anywhere a real trainee could see it.
  let courseDayProgress: { currentDay: number; totalDays: number } | null = null;
  if (showTraineeNav && trainee.course_id) {
    courseDayProgress = await computeCourseDayProgress(supabase, trainee.course_id);
  }

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

  const today = toLocalIso(new Date(), timeZone);
  const [
    { data: lessons },
    { data: assignments },
    { data: preCourseSections },
    { data: preCourseResponses },
    { data: todaysEvents },
  ] = await Promise.all([
    supabase.from("tp_lessons").select("id").eq("trainee_id", trainee.id),
    supabase.from("assignments").select("first_status, resubmission_status").eq("trainee_id", trainee.id),
    supabase.from("pre_course_task_sections").select("id").eq("center_id", trainee.center_id),
    supabase.from("pre_course_task_responses").select("item_id, response").eq("trainee_id", trainee.id),
    trainee.course_id
      ? supabase
          .from("course_timetable_events")
          .select("event_time")
          .eq("course_id", trainee.course_id)
          .eq("event_date", today)
      : Promise.resolve({ data: [] }),
  ]);
  const quietHoursNote = computeQuietHoursNote((todaysEvents ?? []).map((e) => e.event_time), new Date(), today, timeZone);

  const tpsTaught = (lessons ?? []).length;
  const assignmentsPassed = (assignments ?? []).filter(
    (a) => a.first_status === "approved" || a.resubmission_status === "approved"
  ).length;
  // Tasks answered, not sections self-ticked -- same shared
  // responseIsAnswered the task page, the Hub door and the roster use, so
  // every place that shows this fraction shows the same one.
  const { data: preCourseItems } =
    (preCourseSections ?? []).length > 0
      ? await supabase
          .from("pre_course_task_items")
          .select("id")
          .in(
            "section_id",
            (preCourseSections ?? []).map((s) => s.id)
          )
      : { data: [] };
  const preCourseTotal = preCourseItems?.length ?? 0;
  const preCourseAnswered = (preCourseResponses ?? []).filter((r) => responseIsAnswered(r.response)).length;

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Checkpoint 2 (App Redesign.dc.html 1d -- not in the archive, see the
          note in trainer/(hub)/page.tsx) -- collapses the old 2-block
          header (14px wordmark bar + a separate .sheet identity block with
          avatar/3 StatBars/trajectory pill) into one 56px bar: back-link +
          name + trajectory-status pill on the left, "Preview as trainee" on
          the right. Attendance hours (previously a StatBar) has no slot in this
          layout and isn't shown here any more -- still visible on the
          roster table and Today's "Needs you" alerts. */}
      {showTraineeNav ? <InstallPrompt /> : null}

      {showTraineeNav ? (
        // Ramy, 2026-08-24: "think of this as one big sheet of paper... it
        // will extend the width of the entire screen. Connect will have the
        // same color [as the sheet], but a line between the piece of paper
        // and Connect, and a line between Connect and the trainee's name."
        // One full-bleed --color-frame surface holding the name banner, the
        // Connect bar, and the sidebar+content row, divided only by hairline
        // rules -- not three separately-colored pieces the way this used to
        // be. The individual content cards inside {children} keep their own
        // distinct --color-card tone; that contrast is the only place color
        // actually changes.
        <div className="flex min-h-0 flex-1 flex-col" style={{ background: "var(--color-frame)" }}>
          <TraineeNameBanner traineeId={trainee.id} traineeName={trainee.full_name} weekNumber={bannerWeekNumber} />
          <div className="border-t border-border" />
          {/* Ramy, 2026-08-24: Connect's own band is a distinct off-white
              ("one end to the other"), not the same tone as the sheet
              around it -- edge-to-edge, so .container goes inside this
              wrapper rather than carrying the background itself. */}
          {/* A trace of teal, not a colour band. Ramy, 30 Aug 2026: "I don't
              think it needs to be wider since it's just the same colour.
              Maybe just give it a tiny bit of colour, maybe a tiny bit of
              teal green or something." So the off-white warms fractionally
              toward the accent and takes a hairline of it along the top --
              enough to stop the band reading as another sheet, not enough to
              compete with the hero card below it. The trainee still has no
              role colour, deliberately: colour in this app signals scope,
              and a candidate only ever has one. */}
          <div
            style={{
              background: "color-mix(in oklab, var(--color-primary) 3%, oklch(99.5% 0.004 90))",
              borderTop: "2px solid color-mix(in oklab, var(--color-primary) 45%, transparent)",
            }}
          >
            <div className="container flex h-14 items-center justify-between gap-4">
              <Link href={`/portfolio/${trainee.id}`} className="shrink-0 block">
                <Wordmark size="header" />
              </Link>
              <TraineeHeaderCorner
                traineeId={trainee.id}
                traineeInitials={traineeInitials}
                courseDayProgress={courseDayProgress}
              />
            </div>
          </div>
          <div className="border-t border-border" />
          <PortfolioFocusRow traineeId={trainee.id} sidebar={<TraineeSidebarNav traineeId={trainee.id} />}>{children}</PortfolioFocusRow>
        </div>
      ) : (
        <div className="border-b border-border bg-card">
          <div className="container flex h-14 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {/* An assessor has no trainer roster. This pill sent them
                  there anyway -- the one control you reach for when you want
                  out, pointing at a screen they cannot use. Ramy, 30 Aug
                  2026: "we will need a return pill because there isn't one."
                  There was one; it just went to the wrong place, which is
                  the same thing from where the assessor is standing. */}
              {assessorCourseId ? (
                <BackLink href="/assessor" label="Assessor pack" />
              ) : (
                <BackLink href="/trainer/roster" label={"Roster"} />
              )}
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
                  {/* The tooltip carries the candidate's own words about why
                      they need consideration -- profiles.special_consideration
                      is deliberately free-text health-adjacent disclosure
                      (migration 0055: "serious illness, bereavement") and is
                      documented there as staff-visible only.
                      
                      An assessor is not staff. Handbook 12.2: "Centres must
                      limit the amount of candidate personal information shared
                      with Cambridge English... The only personal information
                      required is candidate names." The badge still tells them
                      a declaration exists, which is what bears on moderating a
                      judgement; the reason stops at the centre. Found 30 Aug
                      2026 while adding the arrangements strip to the assessor
                      landing -- it was reaching an assessor through the
                      title attribute.
                      
                      Narrowed again the same day: Ramy, asked who is entitled
                      to read the free text, said "tutors". So the tooltip is
                      the course tutors' alone -- not admins, not the assessor,
                      and never the candidate (this whole header only renders
                      on the staff/assessor view). Everyone else who needs to
                      act on it still sees the badge, and the arrangements
                      themselves, which are the operational part. */}
                  <span
                    title={viewer?.role === "trainer" ? (trainee.special_consideration ?? undefined) : undefined}
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
        </div>
      )}

      {/* for-claude-code-assessor-readonly-banner.md: persistent, not the
          "← Assessor pack" link the earlier fix put in the header row
          above -- stays visible however far the assessor scrolls this
          candidate's portfolio. */}
      {assessorCourseId ? <AssessorReadOnlyBanner subject={trainee.full_name} portfolioHref={`/portfolio/${trainee.id}`} /> : null}

      {isCourseStatusReadOnly(trainee.course_status) ? (
        <div className="bg-destructive/8 border-b border-destructive/20">
          <div className="container flex h-9 items-center text-xs text-destructive">
            {COURSE_STATUS_LABEL[trainee.course_status]} -- this portfolio is kept as a record but is
            read-only going forward.
          </div>
        </div>
      ) : null}

      <PreviewBanner traineeId={trainee.id} traineeName={trainee.full_name} />

      {/* Trainee's sidebar+content row already rendered above, inside the
          unified sheet -- this is the staff/assessor PortfolioTabs layout
          only now. */}
      {/* Ramy, 30 Aug 2026: "when the assessor is inside the portfolio, we
          don't need to see the trainee's workspace tabs. It should be the
          whole page." The rail is the candidate's own workspace navigation;
          an assessor navigates from the portfolio landing's cards
          (assessor-landing.tsx), which name each record and open it, and back
          out through the read-only banner. Dropping it gives a long CELTA 5
          or a week of timetable the full width, which is what those records
          want anyway. */}
      {showTraineeNav ? null : assessorCourseId ? (
        <div className="container flex flex-1 flex-col gap-4 py-8">
          <div className="frame min-w-0 flex-1 p-6">{children}</div>
        </div>
      ) : (
        <div className="container flex flex-1 gap-8 py-8">
          <PortfolioTabs traineeId={trainee.id} meta={sidebarMeta} />
          <div className="frame min-w-0 flex-1 p-6">{children}</div>
        </div>
      )}

      <footer className={`mt-auto flex flex-col items-center gap-3 py-8 text-center text-xs text-muted ${showTraineeNav ? "pb-20 md:pb-8" : ""}`}>
        <span>
          {[center?.name, center ? `Cambridge CELTA (Centre ${center.center_number})` : null, `Workspace link ${trainee.id.slice(0, 8)}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {/* The always-available install entry, for trainees this time.
        
            Ramy: "I want to make sure that the shortcut on your phone, on
            your desktop, that option is also for the trainees, because I
            don't see it." He could not: trainees had only the banner
            variant, gated on beforeinstallprompt -- an event Chrome
            withholds behind its own heuristics and Firefox and desktop
            Safari never fire -- so for most people it never appeared. Same
            fault already fixed for volunteers.
        
            Five weeks of daily use is the original reason build-spec §7
            wanted this offered to trainees at all; the banner stays for the
            first visit, and this is the way back to it afterwards. */}
        {showTraineeNav ? <InstallPrompt variant="inline" /> : null}
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
