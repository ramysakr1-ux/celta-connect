import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { getInitialStaffChatData } from "@/lib/staff-chat";
import { createClient } from "@/lib/supabase/server";

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
  if (profile) {
    const supabase = await createClient();
    const { data: center } = await supabase.from("centers").select("is_demo").eq("id", profile.center_id).maybeSingle();
    isDemo = center?.is_demo ?? false;
    if (profile.course_id) {
      const { data: course } = await supabase.from("courses").select("name").eq("id", profile.course_id).maybeSingle();
      courseCode = course?.name ?? null;
    }
  }

  return (
    <>
      {isDemo ? <DemoModeBanner /> : null}
      {/* for-claude-code-trainer-homepage.md's header spec: wordmark + nav
          on the left, just trainer name + a conditional Connect Hub icon on
          the right -- "only if the account has hub access... other tutors
          on the same course never see this icon." Approximated with the
          real signal that already exists (profile.connect_hub_link set),
          rather than inventing a new access-flag column: whoever hasn't
          personally connected a link never sees anything here at all, no
          "go set one up" fallback either (that moved to Roster, along with
          Share Assessor Link and the Trainer/Trainee/Student switcher --
          neither is in this spec's header list, and both are real,
          course-wide actions that fit better there anyway). */}
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-stretch justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href="/trainer" className="block shrink-0">
              <Wordmark size="header" />
            </Link>
            <TrainerTabs rosterOnly={isAssessor} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* Merge note (2026-08-16): the overnight session's Hub-icon
                gating wins over this morning's -- it gates strictly on
                connect_hub_link being set, exactly as the spec's `hub_access`
                asks, and moved the "go set one up" entry point to Roster so
                nothing is stranded. That answers the question this morning's
                version had left open. Only the course-code pill is kept from
                this side; the spec's header lists it and the overnight header
                didn't have one. */}
            {courseCode ? (
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                {courseCode}
              </span>
            ) : null}
            {isRealStaff && profile?.connect_hub_link ? (
              <a
                href={profile.connect_hub_link}
                target="_blank"
                rel="noopener noreferrer"
                title="Connect Hub"
                className="flex size-[26px] items-center justify-center rounded-full border border-border text-muted hover:border-primary hover:text-primary"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
            <span className="text-sm text-muted">{profile?.full_name ?? session?.email}</span>
          </div>
        </div>
      </header>

      <div className="container flex-1 py-8">{children}</div>

      {profile && staffChat ? (
        <StaffChatDrawer
          profileId={profile.id}
          initialChannels={staffChat.channels}
          coworkers={staffChat.coworkers}
          retentionDays={staffChat.chatRetentionDays}
        />
      ) : null}
    </>
  );
}
