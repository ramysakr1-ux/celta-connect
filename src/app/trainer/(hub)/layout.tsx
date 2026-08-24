import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId, isAssessorTourMode } from "@/lib/auth/portfolio-access";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CourseSwitcher, type SwitcherCourse } from "@/app/trainer/(hub)/course-switcher";

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
  const HUB_INK = "oklch(23.5% 0.017 65)"; // = --color-ink
  const HUB_TEAL = "oklch(37.5% 0.058 195)"; // = --color-primary, written literally so this doesn't drift if that token ever does
  const HUB_GARNET = "oklch(42% 0.13 27)";
  const HUB_GARNET_BRIGHT = "oklch(70% 0.16 27)"; // MCT-side hover accent -- brighter than the header's own garnet underline, so it reads against both the dark header and light card rows
  const headerInk = isMct ? "oklch(96% 0.008 85)" : "oklch(97% 0.006 85)";
  const hubVars = {
    "--hub-header-bg": isMct ? HUB_INK : HUB_GARNET,
    "--hub-header-underline": isMct ? HUB_GARNET : HUB_TEAL,
    "--hub-hover-accent": isMct ? HUB_GARNET_BRIGHT : HUB_TEAL,
    "--hub-row-shadow": isMct
      ? `inset 0 0 0 1px ${HUB_GARNET_BRIGHT}, 0 3px 8px -3px oklch(70% 0.16 27 / 0.35)`
      : `inset 0 0 0 1px ${HUB_TEAL}, 0 3px 8px -3px color-mix(in oklab, ${HUB_TEAL} 45%, transparent)`,
    "--hub-tile-bg": `color-mix(in oklab, ${headerInk} 22%, transparent)`,
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
    const supabase = await createClient();
    const { data: center } = await supabase.from("centers").select("is_demo").eq("id", profile.center_id).maybeSingle();
    isDemo = center?.is_demo ?? false;
    if (profile.course_id) {
      const { data: course } = await supabase.from("courses").select("name").eq("id", profile.course_id).maybeSingle();
      courseCode = course?.name ?? null;
    }
    if (profile.role === "trainer" || profile.role === "platform_owner") {
      const admin = createAdminClient();
      const { data: tutorLinks } = await admin
        .from("course_tutors")
        .select("course_id")
        .eq("profile_id", profile.id)
        .is("left_at", null);
      const linkedCourseIds = [...new Set((tutorLinks ?? []).map((l) => l.course_id))];
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
      {/* Trainer Homepage - MCT vs ACT.dc.html: a lean logo row (just the
          mark + a single MCT/ACT badge) with the tabs as their own second
          row underneath, border-topped -- fixes the crowding of the old
          single 56px row that carried the logo AND every tab AND the
          course pill/Command center pill/name at once. Ramy, 24 Aug 2026:
          "make the bar wider" -- full width (px-6) rather than the same
          1280px .container the tabs used to share with the page's own
          content sheet below; nothing about the header needs to line up
          with that. Command center pill dropped entirely per Ramy same
          day: for a platform_owner, the logo itself now IS that link --
          "connect will actually connect me to my command center, but only
          me" -- everyone else keeps its normal go-to-my-course-Today
          behavior. */}
      <header className={isRealStaff ? "trainer-header" : "border-b border-border bg-card"}>
        <div className="flex h-12 items-center justify-between px-[18px]">
          <Link
            href={profile?.role === "platform_owner" ? "/platform/command-center" : isAssessor ? "/assessor" : "/trainer"}
            className="block shrink-0"
          >
            <Wordmark
              size="header-compact"
              onDark={isRealStaff}
              tileBg={isRealStaff ? "var(--hub-tile-bg)" : undefined}
              wordColor={isRealStaff ? "oklch(60% 0.11 70)" : undefined}
              gapPx={isRealStaff ? 9 : undefined}
            />
          </Link>
          {isRealStaff ? (
            <span
              className="rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-[0.1em] uppercase"
              style={{
                color: headerInk,
                background: isMct
                  ? `color-mix(in oklab, ${HUB_TEAL} 55%, ${HUB_INK})`
                  : `color-mix(in oklab, black 20%, ${HUB_GARNET})`,
              }}
            >
              {isMct ? "MCT" : "ACT"}
            </span>
          ) : null}
        </div>
        <div
          className={`flex items-stretch justify-between gap-6 border-t px-[18px] ${isRealStaff ? "border-[color-mix(in_oklab,white_15%,transparent)]" : "border-border"}`}
        >
          <TrainerTabs rosterOnly={isAssessor && !tourMode} tourMode={tourMode} dark={isRealStaff} />
          <div className="flex shrink-0 items-center gap-3">
            {switcherCourses.length > 1 && profile?.course_id ? (
              <CourseSwitcher courses={switcherCourses} activeCourseId={profile.course_id} />
            ) : courseCode ? (
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                {courseCode}
              </span>
            ) : null}
            <span className={`text-sm ${isRealStaff ? "text-[color-mix(in_oklab,white_85%,transparent)]" : "text-muted"}`}>
              {profile?.full_name ?? session?.email}
            </span>
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
        <div className="frame p-6">{children}</div>
      </div>

      {profile && staffChat ? (
        <StaffChatDrawer profileId={profile.id} initialChannels={staffChat.channels} coworkers={staffChat.coworkers} />
      ) : null}
    </div>
  );
}
