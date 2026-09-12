"use client";

import { usePathname } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { PagePalettePicker } from "@/app/portfolio/[traineeId]/page-palette-picker";
import type { PagePalette } from "@/lib/trainee-notebook";

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
  pagePalette = null,
}: {
  traineeId: string;
  traineeName: string;
  courseDayProgress: { currentDay: number; totalDays: number; finished: boolean } | null;
  /** The trainee's own paper, on their own portfolio only; null hides the picker. */
  pagePalette?: PagePalette | null;
}) {
  const pathname = usePathname();
  const isLanding = pathname === `/portfolio/${traineeId}`;

  // §1b: on the dark header the corner text lightens to oklch(78% 0.02 80).
  //
  // The credit is not here any more. It spent 10 Sep 2026 moving between this
  // corner, the page's bottom-right, and a floating position clear of the chat
  // bars, colliding with something in each -- Ramy: "it keeps moving, and it
  // blocks the view, and it's not consistent." It lives in the header band now,
  // beside the mark, on every screen. See HeaderCredit.
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {/* A course that has ended says so. It used to go on counting "Day 20
          of 20" indefinitely, which told someone opening Connect weeks later
          that they were still on the last day of a course that was over. */}
      {courseDayProgress ? (
        <span className="text-[11px] font-medium tabular-nums" style={{ color: "oklch(78% 0.02 80)" }}>
          {courseDayProgress.finished
            ? "Course finished"
            : `Day ${courseDayProgress.currentDay} of ${courseDayProgress.totalDays}`}
        </span>
      ) : null}
      {/* Was a hardcoded teal tile with initials computed in the layout --
          one of four separate initials implementations in the app. All of
          them are this component now, and the colour comes from the name
          rather than being the same teal for everyone. */}
      {pagePalette ? <PagePalettePicker current={pagePalette} /> : null}
      <Avatar name={traineeName} size="xs" />
    </div>
  );
}
