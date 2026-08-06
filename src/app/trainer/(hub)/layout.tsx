import { ViewSwitcherPill } from "@/components/view-switcher-pill";
import { TrainerTabs } from "@/app/trainer/trainer-tabs";
import { AssessorLinkButton } from "@/app/trainer/assessor-link-button";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { getInitialStaffChatData } from "@/lib/staff-chat";

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

  return (
    <>
      <div className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between gap-3">
          {/* Was missing here -- dashboard/layout.tsx shows the signed-in
              user's name in its header, this Command Centre header never
              did, no name visible anywhere in the whole hub. Same
              full_name-falls-back-to-email pattern as that header. */}
          <span className="text-sm text-muted">{profile?.full_name ?? session?.email}</span>
          <div className="flex items-center gap-3">
            {isRealStaff ? <AssessorLinkButton /> : null}
            {isRealStaff ? <ViewSwitcherPill current="trainer" /> : null}
          </div>
        </div>
      </div>

      <TrainerTabs rosterOnly={isAssessor} />

      <div className="container flex-1 py-8">{children}</div>

      {profile && staffChat ? (
        <StaffChatDrawer profileId={profile.id} initialChannels={staffChat.channels} coworkers={staffChat.coworkers} />
      ) : null}
    </>
  );
}
