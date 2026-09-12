import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { responseIsAnswered } from "@/lib/pre-course-task-shape";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId, getPortfolioTrainee, getPortfolioViewer } from "@/lib/auth/portfolio-access";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { Eye } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { PortfolioTabs } from "@/app/portfolio/[traineeId]/portfolio-tabs";
import { TraineeSidebarNav } from "@/app/portfolio/[traineeId]/trainee-sidebar-nav";
import { buildRailStatus, type RailStatus } from "@/lib/trainee-rail-status";
import { getTraineeStreamDayOrNext, type TraineeDayView } from "@/lib/trainee-day";
import { HeaderDayBar } from "@/app/portfolio/[traineeId]/header-day-bar";
import { HeaderCredit } from "@/components/designer-credit";
import { TraineeHeaderCorner } from "@/app/portfolio/[traineeId]/trainee-header-corner";
import { TraineeMobileNav } from "@/app/portfolio/[traineeId]/trainee-mobile-nav";
import { TraineeNotebook } from "@/app/portfolio/[traineeId]/trainee-notebook";
import { NOTEBOOK_PAPERS, PAGE_PALETTES, pagePaletteVars, type NotebookPaper, type PagePalette, type TraineeNote } from "@/lib/trainee-notebook";
import { signNotebookAudio } from "@/app/portfolio/[traineeId]/notebook-actions";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { Avatar } from "@/components/avatar";

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
  const session = await getPortfolioViewer();
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

  // The notebook (migration 0293): the candidate's own, on their own
  // portfolio only -- not a peer's under the observation carve-out, not a
  // staff preview. Read through the RLS client; the tables are newer than
  // the generated types.
  const ownNotebook = viewer?.role === "trainee" && viewer.id === traineeId;
  let notebookNotes: TraineeNote[] = [];
  let notebookPaper: NotebookPaper = "blue";
  let pagePalette: PagePalette = "linen";
  const notebookAssignmentTitles: Record<string, string> = {};
  if (ownNotebook) {
    const db = supabase as unknown as SupabaseClient;
    const [{ data: noteRows }, { data: setting }, { data: assignmentRows }] = await Promise.all([
      db.from("trainee_notes").select("id, anchor_path, anchor_label, body, created_at, updated_at, audio_path, audio_duration_seconds").eq("trainee_id", traineeId).order("created_at", { ascending: false }).limit(200),
      // select("*"): page_palette arrives with migration 0295, and a named
      // column that is not there yet would fail the whole read, paper included.
      db.from("trainee_notebook_settings").select("*").eq("trainee_id", traineeId).maybeSingle(),
      supabase.from("assignments").select("id, assignment_type").eq("trainee_id", traineeId),
    ]);
    notebookNotes = await signNotebookAudio((noteRows ?? []) as TraineeNote[]);
    if (setting?.paper && (NOTEBOOK_PAPERS as readonly string[]).includes(setting.paper)) notebookPaper = setting.paper as NotebookPaper;
    if (setting?.page_palette && (PAGE_PALETTES as readonly string[]).includes(setting.page_palette)) pagePalette = setting.page_palette as PagePalette;
    for (const a of assignmentRows ?? []) notebookAssignmentTitles[a.id] = ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type;
  }

  // The rail's foot ("Week 3 of 5" over the tick strip) and, with it, every
  // door's status line. Ramy, 9 Sep 2026: "plugged into the layout" -- so this
  // runs for every page under this layout, not just the landing.
  //
  // TraineeNameBanner used to take the week number alone and render it above
  // the Connect header. The banner is gone (the hero row on Course Stream says
  // who and when now, in the place a reader actually looks), but the same
  // computeWeekOf value it was fetching still earns its query here.
  let bannerWeekNumber: number | null = null;
  let weekTotal: number | null = null;
  let railStatus: RailStatus | null = null;
  let traineeDay: TraineeDayView | null = null;
  if (showTraineeNav && trainee.course_id) {
    const { data: courseDates } = await supabase.from("courses").select("start_date, end_date").eq("id", trainee.course_id).maybeSingle();
    const todayIso = toLocalIso(new Date(), timeZone);
    const weekOf = courseDates?.start_date && courseDates?.end_date ? computeWeekOf(courseDates.start_date, courseDates.end_date, todayIso) : null;
    const parts = weekOf?.match(/week (\d+) of (\d+)/);
    bannerWeekNumber = parts ? Number(parts[1]) : null;
    weekTotal = parts ? Number(parts[2]) : null;
    traineeDay = await getTraineeStreamDayOrNext(supabase, trainee.id, trainee.course_id, todayIso, timeZone);
    railStatus = await buildRailStatus({
      supabase,
      traineeId: trainee.id,
      courseId: trainee.course_id,
      todayIso,
      weekNumber: bannerWeekNumber,
      weekTotal,
      startDate: courseDates?.start_date ?? null,
      endDate: courseDates?.end_date ?? null,
    });
  }

  // specs/for-claude-code-trainee-interface.md §"Header": "Day N of 20"
  // course-day counter, right side, next to the avatar -- computeCourseDayProgress
  // already existed (built for the FOL spot-check page's own Day N language)
  // but was never actually called from the trainee header itself, so the
  // spec's counter never rendered anywhere a real trainee could see it.
  let courseDayProgress: { currentDay: number; totalDays: number; finished: boolean } | null = null;
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
    // The trainee's paper (migration 0295): the neutral ladder re-hued on
    // this surface only. Semantic colours are untouched -- see pagePaletteVars.
    <div id="trainee-surface" className="flex min-h-screen flex-col bg-background" style={ownNotebook ? (pagePaletteVars(pagePalette) as React.CSSProperties) : undefined}>
      {/* Checkpoint 2 (App Redesign.dc.html 1d -- not in the archive, see the
          note in trainer/(hub)/page.tsx) -- collapses the old 2-block
          header (14px wordmark bar + a separate .sheet identity block with
          avatar/3 StatBars/trajectory pill) into one 56px bar: back-link +
          name + trajectory-status pill on the left, "Preview as trainee" on
          the right. Attendance hours (previously a StatBar) has no slot in this
          layout and isn't shown here any more -- still visible on the
          roster table and Today's "Needs you" alerts. */}
      {showTraineeNav ? <InstallPrompt landingPath={`/portfolio/${trainee.id}`} /> : null}

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
          <div className="border-t border-border" />
          {/* design_handoff_trainee_landing §1b, "Dark header + day bar".
              Ramy, 10 Sep 2026: "the colourful header and the clock on the
              header is what actually makes this page cool."

              56px on ink-warm, no bottom border, 28px between three blocks:
              the wordmark, the day bar, the corner. The bar is the whole day
              at a glance, and it renders from the SAME StreamDay the main
              track below renders from, so the two cannot disagree.

              This retires the 30 Aug band -- near-white warmed 3% toward teal
              with a teal hairline on top. Against the beige page it read as a
              separate white sheet, which is what he kept seeing. */}
          <div style={{ background: "var(--color-ink-warm)" }}>
            {/* One row from md up, exactly as it was. Below that the bar drops
                to a full-width second line rather than fighting the wordmark,
                the day counter and the clock for a 375px row -- measured on
                production 10 Sep 2026, the track had 24px to draw a whole day
                in and the clock printed on top of "Day 19 of 20".

                The wrapper below is `md:contents`, so on desktop its children
                sit in this same flex row and the gap-7 rhythm is unchanged;
                `md:order-*` keeps the bar between the credit and the corner
                even though it comes after them in the markup. */}
            <div className="container flex flex-col justify-center gap-1.5 py-2 md:h-14 md:flex-row md:items-center md:gap-7 md:py-0">
              <div className="flex min-w-0 items-center gap-3 md:contents">
                <Link href={`/portfolio/${trainee.id}`} className="block shrink-0">
                  <Wordmark
                    size="header"
                    onDark
                    tileBg="color-mix(in oklab, oklch(98.5% 0.006 90) 12%, transparent)"
                  />
                </Link>
                <HeaderCredit onDark />
                <div className="min-w-0 flex-1 md:hidden" />
                <div className="shrink-0 md:order-3">
                  <TraineeHeaderCorner
                    traineeId={trainee.id}
                    traineeName={trainee.full_name}
                    courseDayProgress={courseDayProgress}
                    pagePalette={ownNotebook ? pagePalette : null}
                  />
                </div>
              </div>
              {/* On a day with nothing timetabled the bar draws the NEXT day,
                  named ("Mon · 10:00"), marker parked at its start -- Ramy,
                  12 Sep 2026: "the bar should still be there ... it should not
                  disappear." Only a course with no day left at all draws no
                  bar, and then no second line on a phone either -- an empty
                  strip under the wordmark would be a header that grew to say
                  nothing. */}
              {traineeDay && traineeDay.day.slots.length > 0 ? (
                <div className="flex min-w-0 flex-1 md:order-2">
                  <HeaderDayBar
                    day={traineeDay.day}
                    serverNowMs={Date.now()}
                    timeZone={timeZone}
                    dayLabel={
                      traineeDay.isToday
                        ? undefined
                        : new Date(`${traineeDay.dateIso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" })
                    }
                  />
                </div>
              ) : (
                <div className="hidden min-w-0 flex-1 md:order-2 md:block" />
              )}
            </div>
          </div>
          <PortfolioFocusRow traineeId={trainee.id} sidebar={<TraineeSidebarNav traineeId={trainee.id} status={railStatus} />}>{children}</PortfolioFocusRow>
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
              <Avatar name={trainee.full_name} size="sm" />
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

      {/* Ramy, 1 Sep 2026: "Keep this on your home screen... it's totally
          hidden behind the chat pill."

          The padding cleared the mobile nav and nothing else. The chat pill
          is fixed at bottom-6 on desktop and bottom-20 on mobile, and is
          roughly 44-52px tall, so it occupies 24-68px up on desktop against
          32px of padding, and 80-132px up on mobile against 80px. The last
          thing in this footer sat underneath it in both. Same fault, and the
          same fix, as the Centre settings bar on 26 Aug. */}
      <footer className={`mt-auto flex flex-col items-center gap-3 py-8 text-center text-xs text-muted ${showTraineeNav ? "pb-40 md:pb-24" : ""}`}>
        <span>
          {[center?.name, center ? `Cambridge CELTA (Centre ${center.center_number})` : null, `Workspace link ${trainee.id.slice(0, 8)}`]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {/* The inline install button sat here from 30 Aug to 6 Sep 2026 as
            the way back after "Not now". It ended up almost on top of the
            mobile nav pill, and with the banner's week-long snooze there is
            a way back already -- so the banner above is the one door, on
            the landing page only (Ramy, 6 Sep 2026). */}
      </footer>

      {showTraineeNav ? <TraineeMobileNav traineeId={trainee.id} /> : null}
      {ownNotebook ? (
        <TraineeNotebook
          traineeId={trainee.id}
          initialNotes={notebookNotes}
          initialPaper={notebookPaper}
          assignmentTitles={notebookAssignmentTitles}
          timeZone={timeZone}
        />
      ) : null}

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
