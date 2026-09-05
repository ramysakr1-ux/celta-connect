import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId, isAssessorTourMode } from "@/lib/auth/portfolio-access";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { CourseSwitcher, type SwitcherCourse } from "@/app/trainer/(hub)/course-switcher";
import { canSeeTrainerInTraining } from "@/lib/tit-access";

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

  // Chat is trainer-only, no admin exception -- see migration 0039's
  // "you cannot be on the course unless registered as a trainer" rule.
  const staffChat = profile?.role === "trainer" ? await getInitialStaffChatData(profile.id) : null;

  // profiles.tutor_role is set once at signup for a trainer's first course
  // and never re-synced when an admin later changes their role on a
  // specific course (changeTutorRole only touches course_tutors.tutor_role)
  // -- and a platform_owner never goes through signup at all, so that field
  // is always null for them regardless of which course they're actually
  // linked into. course_tutors.tutor_role for the course they're CURRENTLY
  // on (profile.course_id) is the one place this is never stale, so that's
  // what decides MCT-vs-ACT coloring below, not the profiles column.
  let currentCourseTutorRole: string | null = null;
  if (profile?.course_id) {
    const admin = createAdminClient();
    const { data: link } = await admin
      .from("course_tutors")
      .select("tutor_role")
      .eq("course_id", profile.course_id)
      .eq("profile_id", profile.id)
      .is("left_at", null)
      .maybeSingle();
    currentCourseTutorRole = link?.tutor_role ?? null;
  }

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
  const isMct = Boolean(profile && (profile.role === "admin" || currentCourseTutorRole === "main_course_tutor"));
  // Trainer-in-Training tab: only for the people the record concerns, and
  // only when the course has one. A touring assessor sees it view-only.
  const assessorCourseId = isAssessor ? await getAssessorCourseId() : null;
  const tintVisible = await canSeeTrainerInTraining({
    courseId: profile?.course_id ?? assessorCourseId ?? null,
    profile: profile ? { id: profile.id, role: profile.role, isMct } : null,
    assessorTour: tourMode,
  });
  // design_handoff_trainer_homepage_v4, Design Tokens: "MCT accent -- garnet
  // oklch(42% 0.13 27), deep oklch(36% 0.12 27); ACT accent -- gold
  // oklch(60% 0.11 70), deep oklch(50% 0.11 65)". The accent is the role
  // pill, the active tab, the primary button and the NOW state; the header
  // itself is no longer a coloured band (was ink for MCT, garnet for ACT
  // until 5 Sep 2026) but the same light bar for everyone. An assessor
  // session, which v4 does not restyle, keeps Connect's teal as its accent.
  const HUB_GARNET = "oklch(42% 0.13 27)";
  const HUB_GARNET_DEEP = "oklch(36% 0.12 27)";
  const HUB_GOLD = "oklch(60% 0.11 70)";
  const HUB_GOLD_DEEP = "oklch(50% 0.11 65)";
  const HUB_TEAL = "oklch(37.5% 0.058 195)"; // = --color-primary
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
    const admin = createAdminClient();
    const wantsTutorLinks = profile.role === "trainer" || profile.role === "platform_owner";
    // None of these three depend on each other's results -- center is now
    // cross-request cached (is_demo essentially never changes), course
    // only needs profile.course_id, tutorLinks only needs profile.id. Was
    // 2-3 stacked sequential round trips on every single page under
    // /trainer/(hub)/*, now effectively free (center) or one batch.
    const [center, courseResult, tutorLinksResult] = await Promise.all([
      getCachedCenter(profile.center_id),
      profile.course_id ? admin.from("courses").select("name").eq("id", profile.course_id).maybeSingle() : Promise.resolve({ data: null }),
      wantsTutorLinks ? admin.from("course_tutors").select("course_id").eq("profile_id", profile.id).is("left_at", null) : Promise.resolve({ data: null }),
    ]);
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
        <div className="flex h-14 items-center gap-[18px] px-[22px]">
          <Link
            href={profile?.role === "platform_owner" ? "/platform/command-center" : isAssessor ? "/assessor" : "/trainer"}
            className="block shrink-0"
          >
            <Wordmark size="header-compact" gapPx={9} />
          </Link>
          <TrainerTabs rosterOnly={isAssessor && !tourMode} tourMode={tourMode} mct={isMct && !isAssessor} tint={tintVisible} />
          <div className="flex shrink-0 items-center gap-[11px]">
            {isRealStaff ? (
              <span
                className="rounded-full px-[9px] py-1 text-[10.5px] font-bold tracking-[0.09em] text-primary-foreground uppercase"
                style={{ background: accent }}
              >
                {isMct ? "MCT" : "ACT"}
              </span>
            ) : null}
            {switcherCourses.length > 1 && profile?.course_id ? (
              <CourseSwitcher courses={switcherCourses} activeCourseId={profile.course_id} />
            ) : courseCode ? (
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-ink">{courseCode}</span>
            ) : null}
            <span className="text-[13px] font-semibold text-ink">{profile?.full_name ?? session?.email}</span>
            {/* v4 draws "Settings" here. The tutor's own preferences
                (feedback assist) live behind it, off Today. */}
            {isRealStaff ? (
              <Link href="/trainer/settings" className="text-[12.5px] text-muted transition-colors hover:text-ink hover:underline">
                Settings
              </Link>
            ) : null}
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
  );
}
