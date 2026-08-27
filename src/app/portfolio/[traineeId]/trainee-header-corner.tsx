"use client";

import { usePathname } from "next/navigation";
import { DesignerCredit } from "@/components/designer-credit";

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
  traineeInitials,
  courseDayProgress,
}: {
  traineeId: string;
  traineeInitials: string;
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
      <div className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px]" style={{ background: "oklch(93% 0.019 190)" }}>
        <span className="text-[9px] font-bold" style={{ color: "oklch(32% 0.05 195)" }}>{traineeInitials}</span>
      </div>
    </div>
  );
}
