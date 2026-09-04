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

  if (isLanding) return <DesignerCredit pinned={false} />;

  return (
    <div className="flex shrink-0 items-center gap-2.5">
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
