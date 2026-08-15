"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StaffChatDrawer } from "@/app/dashboard/staff-chat/staff-chat-drawer";
import type { Message } from "@/app/dashboard/staff-chat/message-thread";
import type { ChannelSummary, Coworker } from "@/lib/staff-chat";

// layout.tsx cannot receive `searchParams` as a prop -- confirmed live,
// Next.js App Router only passes it to page.tsx, and a layout that tries
// to await it crashes the whole subtree. These small client components
// read the current ?preview=trainee param themselves via useSearchParams
// instead, so the shared portfolio chrome (trajectory pill, chat drawer,
// eyebrow label, exit banner) can still react to it. Purely presentational
// -- the data behind these is fetched server-side regardless of preview
// state, this only ever controls whether it renders.
function isPreviewingAsTrainee(searchParams: URLSearchParams): boolean {
  return searchParams.get("preview") === "trainee";
}

export function HideDuringPreview({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  if (isPreviewingAsTrainee(searchParams)) return null;
  return <>{children}</>;
}

// Real trainees/assessors always see this label; a staff member sees it
// too, but only while previewing (isStaff stays true the whole time, this
// is the one spot where preview mode ADDS a render rather than removing one).
export function TraineeEyebrowLabel({ isStaff, readOnly }: { isStaff: boolean; readOnly: boolean }) {
  const searchParams = useSearchParams();
  if (isStaff && !isPreviewingAsTrainee(searchParams)) return null;
  return (
    <p className="text-[10px] tracking-[0.1em] text-muted uppercase">
      Trainee Workspace{readOnly ? " · read-only" : ""}
    </p>
  );
}

interface ChatPayload {
  channels: ChannelSummary[];
  coworkers: Coworker[];
  chatRetentionDays: number;
}

// Picks which chat to render: the staff member's own (normal view) vs the
// TARGET TRAINEE's own channels, read-only (preview view). Hiding chat
// entirely during preview was the first attempt -- confirmed live that was
// wrong too, since a real trainee genuinely has their own chat (TP-group +
// DM-their-tutor), so a preview that shows nothing isn't accurate either.
export function ChatDrawerSwitcher({
  staffProfileId,
  staffChat,
  traineeId,
  traineePreviewChat,
  traineePreviewLatestMessage,
  quietHoursNote,
  raiseForMobileNav = false,
}: {
  staffProfileId: string | null;
  staffChat: ChatPayload | null;
  traineeId: string;
  traineePreviewChat: ChatPayload | null;
  traineePreviewLatestMessage?: Message | null;
  quietHoursNote?: string | null;
  // Only true for the real trainee's own (non-preview) render -- see
  // StaffChatDrawer's own comment. Preview mode doesn't get the mobile tab
  // bar (portfolio/[traineeId]/layout.tsx's showTraineeNav is server-role-
  // computed, not preview-aware -- an existing, separately disclosed gap),
  // so its chat pill correctly keeps the default offset.
  raiseForMobileNav?: boolean;
}) {
  const searchParams = useSearchParams();
  if (isPreviewingAsTrainee(searchParams)) {
    if (!traineePreviewChat) return null;
    return (
      <StaffChatDrawer
        profileId={traineeId}
        initialChannels={traineePreviewChat.channels}
        coworkers={traineePreviewChat.coworkers}
        staticMessages={traineePreviewLatestMessage ? [traineePreviewLatestMessage] : []}
        retentionDays={traineePreviewChat.chatRetentionDays}
        readOnly
      />
    );
  }
  if (!staffProfileId || !staffChat) return null;
  return (
    <StaffChatDrawer
      profileId={staffProfileId}
      initialChannels={staffChat.channels}
      coworkers={staffChat.coworkers}
      quietHoursNote={quietHoursNote}
      retentionDays={staffChat.chatRetentionDays}
      raiseForMobileNav={raiseForMobileNav}
    />
  );
}

export function PreviewBanner({ traineeId, traineeName }: { traineeId: string; traineeName: string }) {
  const searchParams = useSearchParams();
  if (!isPreviewingAsTrainee(searchParams)) return null;
  return (
    <div className="bg-primary">
      <div className="container flex h-9 items-center justify-between text-xs text-primary-foreground">
        <span>Previewing as {traineeName} -- staff-only controls are hidden.</span>
        <Link href={`/portfolio/${traineeId}`} className="font-semibold underline underline-offset-2">
          Exit preview
        </Link>
      </div>
    </div>
  );
}
