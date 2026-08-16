import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";
import { AssessorLinkButton } from "@/app/trainer/assessor-link-button";
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
      {/* Checkpoint 1 shell consolidation (specs/build-spec.md phase 1) --
          this used to be 3 stacked bars (this one, a duplicate name-only
          bar in trainer/layout.tsx, and TrainerTabs' own wrapper). Now one
          56px (h-14) header: wordmark + nav on the left, assessor
          link/view-switcher/name on the right. */}
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-stretch justify-between gap-6">
          <div className="flex items-center gap-6">
            <Link href="/trainer" className="block shrink-0">
              <Wordmark size="header" />
            </Link>
            <TrainerTabs rosterOnly={isAssessor} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {/* Spec: course code as a teal pill, then the trainer's name, then
                the Hub icon. The ViewSwitcherPill that used to sit here is
                retired (Ramy, 2026-08-16) -- both its live segments pointed at
                pages that are already nav tabs, and candidate preview moved to
                a per-candidate button on the Portfolio screen. */}
            {courseCode ? (
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                {courseCode}
              </span>
            ) : null}
            {isRealStaff ? (
              // Spec shrinks this from a labelled button to a 26x26 hollow
              // icon. NOTE: it also says to show it only for accounts with
              // `hub_access` -- no such column exists (0065 added only
              // profiles.connect_hub_link, self-service: anyone pastes their
              // own link). Gating strictly on "link is set" would make
              // /trainer/connect-hub unreachable for anyone who hasn't set one,
              // i.e. everyone, so the entry point is kept until Ramy decides
              // whether Hub access is meant to be granted rather than
              // self-served.
              <a
                href={profile?.connect_hub_link ?? "/trainer/connect-hub"}
                {...(profile?.connect_hub_link ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                title={profile?.connect_hub_link ? "Open your Connect Hub" : "Set up your Connect Hub link"}
                aria-label={profile?.connect_hub_link ? "Open your Connect Hub" : "Set up your Connect Hub link"}
                className="flex size-[26px] shrink-0 items-center justify-center rounded-[6px] border border-border text-muted hover:border-primary hover:text-primary"
              >
                <LayoutGrid className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
            {isRealStaff ? <AssessorLinkButton /> : null}
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
