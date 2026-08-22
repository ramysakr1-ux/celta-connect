import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
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
  const isRealStaff = profile?.role === "trainer" || profile?.role === "admin";
  const isAssessor = !isRealStaff && Boolean(await getAssessorCourseId());

  // Chat is trainer-only, no admin exception -- see migration 0039's
  // "you cannot be on the course unless registered as a trainer" rule.
  const staffChat = profile?.role === "trainer" ? await getInitialStaffChatData(profile.id) : null;

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
    if (profile.role === "trainer") {
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
    <div className="flex min-h-full flex-1 flex-col bg-tint-in-course">
      {isDemo ? <DemoModeBanner /> : null}
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-stretch justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href="/trainer" className="block shrink-0">
              <Wordmark size="header" />
            </Link>
            <TrainerTabs rosterOnly={isAssessor} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {switcherCourses.length > 1 && profile?.course_id ? (
              <CourseSwitcher courses={switcherCourses} activeCourseId={profile.course_id} />
            ) : courseCode ? (
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                {courseCode}
              </span>
            ) : null}
            <span className="text-sm text-muted">{profile?.full_name ?? session?.email}</span>
          </div>
        </div>
      </header>

      <div className="container flex-1 py-8">{children}</div>

      {profile && staffChat ? (
        <StaffChatDrawer profileId={profile.id} initialChannels={staffChat.channels} coworkers={staffChat.coworkers} />
      ) : null}
    </div>
  );
}
