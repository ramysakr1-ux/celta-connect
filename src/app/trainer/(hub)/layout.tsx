import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { HeaderCredit } from "@/components/designer-credit";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";
import { isActPreview } from "@/lib/act-preview";
import { enterActPreview, exitActPreview } from "@/app/trainer/(hub)/act-preview-actions";
import { showWholeCourse, showMyGroup } from "@/app/trainer/(hub)/scope-actions";
import { seesWholeCourse } from "@/lib/hub-scope";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId, isAssessorPreview, isAssessorTourMode } from "@/lib/auth/portfolio-access";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { CourseSwitcher, type SwitcherCourse } from "@/app/trainer/(hub)/course-switcher";
import { trainerInTrainingAccess } from "@/lib/tit-access";
import { getCourseTutorRole } from "@/lib/course-tutor-role";
import { HUB_GARNET, HUB_GARNET_DEEP, HUB_GOLD, HUB_GOLD_DEEP, HUB_TEAL } from "@/lib/hub-accent";
import { HubTimeZoneProvider } from "@/components/hub-time-zone";

// The operational "Command Centre" -- roster/timetable/volunteers/TP
// rotation/TP points library/grades report. Deliberately separate from
// the /trainer landing (candidate cards + a link into here) -- landing
// stays a clean first look, this is where the actual day-to-day work
// happens. A route group ((hub)) so every URL underneath stays exactly
// where it already was (/trainer/timetable etc.) -- nothing else in the
// app that links to those routes needed to change.
export default async function TrainerHubLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  const profile = session?.profile ?? null;
  // platform_owner included per for-claude-code-command-center.md, 2026-08-25
  // (Ramy: "I should have access into the course that I'm on, not just the
  // centre that I own") -- a platform_owner with a real course_tutors row
  // lands on the exact same trainer view any other tutor on that course
  // sees, not a restricted or different one.
  const isRealStaff = profile?.role === "trainer" || profile?.role === "admin" || profile?.role === "platform_owner";
  const isAssessor = !isRealStaff && Boolean(await getAssessorCourseId());
  // for-claude-code-assessor-tour-mode.md: the trimmed 3-tab set is the
  // pack's own boundary (Roster/Attendance register/Grades Report only) --
  // a touring assessor gets the real trainer tab set instead, since the
  // whole point is letting them see how the platform actually works.
  const tourMode = isAssessor && (await isAssessorTourMode());
  // Ramy, 10 Sep 2026: "there is no way to go back to the assessor page." A
  // trainer who previews the pack needs a door back to it. The preview cookie
  // is the precise signal that they came from there: only
  // /trainer/assessor/preview sets it, and /assessor/exit clears it (a stale
  // plain assessor cookie does not trigger it). That door is the "Assessor
  // pack" pill below -- NOT the Connect mark, which is a home door (Ramy,
  // 11 Sep 2026: "Connect takes you home").
  const assessorPreview = await isAssessorPreview();

  // Everything the frame needs that depends only on the profile, in ONE
  // wave. Perf audit, 5 Sep 2026: this used to be four stacked round-trip
  // waves (chat, then tutor role, then TinT access, then centre/course/
  // links) on every hub page -- about half a second before the page's own
  // work began. The tutor role now comes from the cache()'d helper Today,
  // Assessor and the TinT page share, so it is fetched once per request.
  const admin = createAdminClient();
  const wantsTutorLinks = profile?.role === "trainer" || profile?.role === "platform_owner";
  const [staffChat, currentCourseTutorRole, center, courseResult, tutorLinksResult] = await Promise.all([
    // Chat is trainer-only, no admin exception -- see migration 0039's
    // "you cannot be on the course unless registered as a trainer" rule.
    profile?.role === "trainer" ? getInitialStaffChatData(profile.id, admin) : Promise.resolve(null),
    // course_tutors.tutor_role for the course CURRENTLY open is the one
    // place the role is never stale (profiles.tutor_role is set once at
    // signup and never re-synced; a platform_owner never has it at all).
    profile?.course_id ? getCourseTutorRole(profile.course_id, profile.id) : Promise.resolve(null),
    profile ? getCachedCenter(profile.center_id) : Promise.resolve(null),
    profile?.course_id ? admin.from("courses").select("name").eq("id", profile.course_id).maybeSingle() : Promise.resolve({ data: null }),
    profile && wantsTutorLinks ? admin.from("course_tutors").select("course_id").eq("profile_id", profile.id).is("left_at", null) : Promise.resolve({ data: null }),
  ]);

  // for-claude-code-trainer-role-color-system-final.md: every trainer-hub
  // page gets a role-colored header band -- ink for the MCT (whole-cohort
  // view), garnet for everyone else on the course (ACT, TP tutor, input
  // tutor -- the doc's own "MCT vs ACT" framing collapses to this one
  // binary). Admin counts as MCT-side, matching every other MCT-equivalent
  // gate this session (trainer.role === "admin" || isMctOnCourse(...)).
  // Assessor/tour sessions are untouched -- this spec is about the real
  // trainer's own session, and the assessor already has its own read-only
  // banner; forcing it into MCT/ACT coloring isn't asked for here.
  // Not isRealStaff-gated -- these vars are set on the whole shell (below),
  // reaching assessor/tour sessions too, since .trainer-hover (globals.css)
  // is used unconditionally by hub pages regardless of session type. Its
  // ACT-shaped default there is a fine, unobtrusive fallback for a session
  // this spec never asked us to re-skin; only the header/tabs/logo
  // themselves stay isRealStaff-gated below, at their own point of use.
  const isMctReal = Boolean(profile && (profile.role === "admin" || currentCourseTutorRole === "main_course_tutor"));
  // MCT → ACT preview (Ramy, 5 Sep 2026): the cookie only dims the DISPLAY
  // role -- every write action keeps checking the real one. One way only.
  const wholeCourse = await seesWholeCourse();
  const actPreview = isMctReal && (await isActPreview());
  const isMct = isMctReal && !actPreview;
  // Trainer-in-Training tab: only for the people the record concerns, and
  // only when the course has one. Any assessor session sees it view-only --
  // where moderation applies, reading the e-portfolio is a duty (TinT
  // Handbook 5.2.2), not something to find on the optional tour.
  const assessorCourseId = isAssessor ? await getAssessorCourseId() : null;
  const tintAccess = await trainerInTrainingAccess({
    courseId: profile?.course_id ?? assessorCourseId ?? null,
    profile: profile ? { id: profile.id, role: profile.role, isMct } : null,
    assessorSession: Boolean(assessorCourseId),
  });
  // Ramy, 6 Sep 2026: "make the trainer-in-training tab always visible too...
  // the tab being visible doesn't mean everybody can go and snoop around. When
  // there is an actual TinT, then there will be safeguards."
  //
  // That reverses his 4 Sep call ("it will only appear if there is one"), and
  // his framing is better than the guard I first wrote. I had kept the tab
  // hidden for anyone outside the circle when a record existed -- but that
  // makes the tab's ABSENCE the tell: an ACT who sees it disappear learns the
  // course has a trainer-in-training. Always visible leaks strictly less.
  //
  // The door is open; the room is not. What is private is the RECORD -- the
  // e-portfolio, the shadow marking, the signature trails -- and the page
  // itself refuses it, telling anyone outside the circle that it is private to
  // the trainer-in-training, their supervisor and the MCT, who can grant them
  // access. RLS (tit_can_access(), migration 0267) enforces the same at the
  // data layer, so the tab is signage, not permission. That a trainer-in-
  // training exists is not a secret: they are on the teaching team.
  //
  // An assessor session is the exception and keeps the strict rule: their tab
  // set is the pack, deliberately minimal, not a place to browse a capability.
  const tintVisible = tintAccess.visible.length > 0;
  const tintTab = assessorCourseId ? tintVisible : true;
  // design_handoff_trainer_homepage_v4, Design Tokens: "MCT accent -- garnet
  // oklch(42% 0.13 27), deep oklch(36% 0.12 27); ACT accent -- gold
  // oklch(60% 0.11 70), deep oklch(50% 0.11 65)". The accent is the role
  // pill, the active tab, the primary button and the NOW state; the header
  // itself is no longer a coloured band (was ink for MCT, garnet for ACT
  // until 5 Sep 2026) but the same light bar for everyone. An assessor
  // session, which v4 does not restyle, keeps Connect's teal as its accent.
  const accent = !isRealStaff ? HUB_TEAL : isMct ? HUB_GARNET : HUB_GOLD;
  const accentDeep = !isRealStaff ? HUB_TEAL : isMct ? HUB_GARNET_DEEP : HUB_GOLD_DEEP;
  const hubVars = {
    "--hub-accent": accent,
    "--hub-accent-deep": accentDeep,
    // .trainer-hover-fill (buttons) and .trainer-hover (rows) in globals.css
    // read these -- Ramy, 27 Aug 2026: hover matches the role's own colour.
    "--hub-hover-accent": accent,
    "--hub-row-shadow": `inset 0 0 0 1px ${accent}, 0 3px 8px -3px color-mix(in oklab, ${accent} 45%, transparent)`,
    // Ramy, 27 Aug 2026: the decorative teal/garnet card alternation
    // (.card-garnet/.sheet-garnet, unrelated to the role hover system
    // above) would otherwise pile a second, unrelated reason for garnet
    // onto ACT screens specifically -- gold instead gives ACT the same
    // "not monotone" effect without doubling up on its own role colour.
    "--hub-decorative-accent": isMct ? HUB_GARNET : "oklch(63% 0.096 72)",
  } as React.CSSProperties;

  let isDemo = false;
  // Spec's header carries the course code as a teal pill ("C2/2024") -- that's
  // courses.name, which is already stored in exactly that form.
  let courseCode: string | null = null;
  // for-claude-code-course-switcher.md: "the badge becomes a dropdown
  // trigger whenever a trainer has more than one active course link."
  // course_tutors' own SELECT policy only exposes rows for the trainer's
  // CURRENT course (course_id = current_course_id()), so seeing every link
  // -- including the ones not currently active -- needs the admin client,
  // same reason switchActiveCourse does.
  let switcherCourses: SwitcherCourse[] = [];
  if (profile) {
    isDemo = center?.is_demo ?? false;
    courseCode = courseResult.data?.name ?? null;

    if (wantsTutorLinks) {
      const linkedCourseIds = [...new Set((tutorLinksResult.data ?? []).map((l) => l.course_id))];
      if (linkedCourseIds.length > 1) {
        const { data: linkedCourses } = await admin
          .from("courses")
          .select("id, name, course_code, is_part_time")
          .in("id", linkedCourseIds);
        switcherCourses = (linkedCourses ?? [])
          .map((c) => ({ id: c.id, label: c.course_code ?? c.name, isPartTime: c.is_part_time }))
          .sort((a, b) => a.label.localeCompare(b.label));
      }
    }
  }

  return (
    <HubTimeZoneProvider timeZone={center?.time_zone}>
    <div className="flex min-h-full flex-1 flex-col" style={hubVars}>
      {isDemo ? <DemoModeBanner /> : null}
      {/* design_handoff_trainer_homepage_v4 README, "Header (56px, white,
          1px bottom border)": one row -- mark, tab row, then the right
          cluster (role pill in the accent, name, Settings). Replaces the
          two-row dark ink/garnet band of 24-27 Aug; Ramy approved the v4
          look on the build mock, 5 Sep 2026. Full width, not the page's
          1280px container -- nothing here needs to line up with the sheet
          below. For a platform_owner the logo IS the Command Center link
          ("connect will actually connect me to my command center, but
          only me"); everyone else gets their course's Today. */}
      <header className="border-b border-border bg-frame">
        {/* One row from sm up, exactly as before. Below sm it wraps: the
            wordmark and the tab row take the first line and the role pill,
            the scope pill and the course switcher drop to a second. They add
            up to ~272px and the space left beside the wordmark on a 375px
            screen is ~94px, so no amount of hiding got them onto one line --
            and the switcher's own spec says the active course badge stays
            shown at all times, so hiding it was the wrong answer anyway. Same
            treatment the trainee header got for its day bar on 10 Sep 2026. */}
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 px-[22px] py-2 sm:h-14 sm:flex-nowrap sm:py-0">
          <Link
            // Ramy, 11 Sep 2026: "Connect takes you home." The mark is a home
            // door, not a back button -- so it goes to the VIEWER's own home:
            // a real assessor's is /assessor, a platform owner's is the command
            // centre, everyone else's is /trainer. A trainer PREVIEWING the
            // pack (assessorPreview) is still a trainer, so their home is
            // /trainer, not /assessor -- sending the mark there took a trainer
            // account to a page it cannot open, which bounced to sign-in. The
            // discoverable way back to the pack is the "Assessor pack" pill
            // beside the mark (below), which is what that fix should have been.
            href={isAssessor ? "/assessor" : profile?.role === "platform_owner" ? "/platform/command-center" : "/trainer"}
            className="block shrink-0"
          >
            <Wordmark size="header-compact" gapPx={9} />
          </Link>
          <HeaderCredit />
          {assessorPreview ? (
            // The wordmark alone is not a discoverable way back -- nobody
            // reads a logo as "return to the thing I was previewing". This
            // says it.
            <Link
              href="/assessor"
              className="trainer-hover-fill flex h-7 shrink-0 items-center rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-ink"
            >
              Assessor pack
            </Link>
          ) : null}
          <TrainerTabs rosterOnly={isAssessor && !tourMode} tourMode={tourMode} mct={isMct && !isAssessor} tint={tintTab} />
          <div className="flex shrink-0 items-center gap-[11px]">
            {isRealStaff && isMctReal ? (
              // The pill is the preview toggle for a real MCT -- one click
              // into the ACT view, one click back (Ramy, 5 Sep 2026).
              <form action={actPreview ? exitActPreview : enterActPreview}>
                <button
                  type="submit"
                  title={actPreview ? "Viewing as an ACT -- click to switch back to your MCT view" : "Click to preview the hub as an ACT sees it"}
                  className="cursor-pointer rounded-full px-[9px] py-1 text-[10.5px] font-bold tracking-[0.09em] text-primary-foreground uppercase transition-[filter] hover:brightness-110"
                  style={{ background: accent }}
                >
                  {actPreview ? "ACT · preview" : "MCT"}
                </button>
              </form>
            ) : isRealStaff ? (
              <span
                className="rounded-full px-[9px] py-1 text-[10.5px] font-bold tracking-[0.09em] text-primary-foreground uppercase"
                style={{ background: accent }}
              >
                ACT
              </span>
            ) : null}
            {/* The scope pill -- Ramy, 11 Sep 2026: "their six by default with
                the full twelve one click away." Real MCT only; an ACT has one
                group and nothing to click through to. Hidden during the ACT
                preview, which is itself a narrower view. Display only: see
                hub-scope.ts. */}
            {isRealStaff && isMctReal && !actPreview ? (
              <form action={wholeCourse ? showMyGroup : showWholeCourse}>
                <button
                  type="submit"
                  title={wholeCourse ? "Showing every candidate on the course -- click for your own group" : "Showing your own group -- click for the whole course"}
                  className="cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-frame"
                >
                  {wholeCourse ? "Whole course" : "Your group"}
                </button>
              </form>
            ) : null}
            {switcherCourses.length > 1 && profile?.course_id ? (
              <CourseSwitcher courses={switcherCourses} activeCourseId={profile.course_id} />
            ) : courseCode ? (
              // Hidden on a phone. The header's right-hand group is shrink-0 on
              // purpose, and with the scope pill beside the role pill this 123px
              // course code was the piece that pushed a 375px screen sideways
              // (432px, measured). A tutor already knows which course they are
              // signed in to; the switcher, when there is more than one, stays.
              <span className="hidden rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-ink sm:inline">{courseCode}</span>
            ) : null}
            {/* The tutor's name is no longer here. Ramy, 11 Sep 2026: "the MCT
                tab bar gets kind of squished, especially when we have the
                assessor pack... remove Jordan Blake [from the bar]." It was the
                widest thing in a shrink-0 cluster and the piece a trainer least
                needs on a screen they are already signed in to -- it had been
                hidden on phones for that reason since 10 Sep. With the Assessor
                tab in the row, the scrollable tab strip was the only thing
                left to give; the ~100px the name held goes back to it. The name
                now greets the tutor in the page's own eyebrow instead, the way
                the trainee landing greets a candidate -- same line, same
                place, on both landings. */}
            {/* v4 drew "Settings" here, and behind it sat exactly one card:
                the tutor's feedback wording. Ramy, 6 Sep 2026 -- the door
                moved to the Teaching Practice tab, next to the feedback it
                shapes, and took a name that says what it does. Two doors to
                a one-card room, one of them vaguely labelled, was worse than
                one door in the right place. */}
          </div>
        </div>
      </header>

      {/* for-claude-code-assessor-readonly-banner.md: persistent, not the
          bare top-of-page link the earlier fix used -- stays visible
          however far the assessor scrolls into a long report. */}
      {isAssessor ? <AssessorReadOnlyBanner /> : null}

      {/* for-claude-code-staff-chat-overlap-fix.md: StaffChatDrawer is
          `fixed bottom-6`, not part of this flow, so the page's own content
          never reserved room for it -- it sat on top of whatever ran to the
          bottom of the viewport instead of the docked element it was meant
          to be. pb-28 (112px) covers the bar's own footprint (56px bar +
          24px offset + margin) at rest; the thread/picker panels that can
          expand above it are a temporary, user-opened overlay, not the
          always-present collapsed state this reserves space for. Only
          added when the bar actually renders below, so a session with no
          chat (assessor view) doesn't carry the extra space for nothing. */}
      <div className={`container flex-1 pt-8 ${profile && staffChat ? "pb-28" : "pb-8"}`}>
        <div className="frame hub-v4 p-6">{children}</div>
      </div>

      {profile && staffChat ? (
        <StaffChatDrawer profileId={profile.id} initialChannels={staffChat.channels} coworkers={staffChat.coworkers} />
      ) : null}
    </div>
    </HubTimeZoneProvider>
  );
}
