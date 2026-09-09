"use client";

import { usePathname } from "next/navigation";
import { DesignerCredit } from "@/components/designer-credit";
import { Avatar } from "@/components/avatar";

// Ramy, 2026-08-24: only the bare landing route gets the credit pill (same
// self-gating pattern as TraineeNameBanner, which the credit sits directly
// below/beside) -- every other trainee page keeps the plain initials chip
// that always lived in this corner. Same slot, two different occupants.
//
// specs/for-claude-code-trainee-interface.md's header also calls for a
// "Day N of 20" course-day counter right here, next to the avatar -- null
// before the course's first timetabled day arrives (nothing sensible to
// show yet), same as computeCourseDayProgress's own contract.
export function TraineeHeaderCorner({
  traineeId,
  traineeName,
  courseDayProgress,
}: {
  traineeId: string;
  traineeName: string;
  courseDayProgress: { currentDay: number; totalDays: number } | null;
}) {
  const pathname = usePathname();
  const isLanding = pathname === `/portfolio/${traineeId}`;

  // Until 9 Sep 2026 the landing returned the credit INSTEAD of these two, so
  // the one screen design_handoff_trainee_landing draws a header for was the
  // one screen missing its right-hand side -- no "Day N of 20", no avatar.
  // That made sense while TraineeNameBanner sat directly below carrying the
  // trainee's name and week; the banner is gone and the credit was the only
  // occupant left. Both now, credit first: the design gets the counter and the
  // avatar it asks for, and Ramy's credit stays on the screen it has always
  // been on.
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {isLanding ? <DesignerCredit pinned={false} /> : null}
      {courseDayProgress ? (
        <span className="text-[11px] font-medium tabular-nums text-muted">
          Day {courseDayProgress.currentDay} of {courseDayProgress.totalDays}
        </span>
      ) : null}
      {/* Was a hardcoded teal tile with initials computed in the layout --
          one of four separate initials implementations in the app. All of
          them are this component now, and the colour comes from the name
          rather than being the same teal for everyone. */}
      <Avatar name={traineeName} size="xs" />
    </div>
  );
}
