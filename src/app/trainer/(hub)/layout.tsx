import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { ViewSwitcherPill } from "@/components/view-switcher-pill";
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
  if (profile) {
    const supabase = await createClient();
    const { data: center } = await supabase.from("centers").select("is_demo").eq("id", profile.center_id).maybeSingle();
    isDemo = center?.is_demo ?? false;
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
            {isRealStaff ? (
              profile?.connect_hub_link ? (
                <a
                  href={profile.connect_hub_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink hover:border-primary"
                >
                  Connect Hub
                </a>
              ) : (
                <Link
                  href="/trainer/connect-hub"
                  className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink hover:border-primary"
                >
                  Connect Hub
                </Link>
              )
            ) : null}
            {isRealStaff ? <AssessorLinkButton /> : null}
            {isRealStaff ? <ViewSwitcherPill current="trainer" /> : null}
            <span className="text-sm text-muted">{profile?.full_name ?? session?.email}</span>
          </div>
        </div>
      </header>

      <div className="container flex-1 py-8">{children}</div>

      {profile && staffChat ? (
        <StaffChatDrawer profileId={profile.id} initialChannels={staffChat.channels} coworkers={staffChat.coworkers} />
      ) : null}
    </>
  );
}
