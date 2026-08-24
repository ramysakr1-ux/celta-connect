"use client";

import { usePathname } from "next/navigation";
import { DesignerCredit } from "@/components/designer-credit";

// Ramy, 2026-08-24: only the bare landing route gets the credit pill (same
// self-gating pattern as TraineeNameBanner, which the credit sits directly
// below/beside) -- every other trainee page keeps the plain initials chip
// that always lived in this corner. Same slot, two different occupants.
export function TraineeHeaderCorner({ traineeId, traineeInitials }: { traineeId: string; traineeInitials: string }) {
  const pathname = usePathname();
  const isLanding = pathname === `/portfolio/${traineeId}`;

  if (isLanding) return <DesignerCredit pinned={false} />;

  return (
    <div className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px]" style={{ background: "oklch(93% 0.019 190)" }}>
      <span className="text-[9px] font-bold" style={{ color: "oklch(32% 0.05 195)" }}>{traineeInitials}</span>
    </div>
  );
}
