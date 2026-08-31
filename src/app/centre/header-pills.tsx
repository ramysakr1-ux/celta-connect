"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PILL_ACTIVE_GARNET, PILL_INACTIVE } from "@/app/centre/header-pill-styles";

// The two same-family pills beside the wordmark: Centre Management and
// Course Admin. Same size, next to each other, teal on whichever view you
// are in.
//
// Ramy, 31 Aug 2026: "pills should sort of have the same size, should be
// next to each other. When one pill is active, the other one is inactive.
// So that the green teal is sort of jumping between them."
//
// Centre owner is NOT in this group -- see CentreOwnerPill below.
//
// What this fixes, beyond the styling: the pills used to be fixed rather
// than positional, so on /centre/owner "Centre management" was a plain span
// with no way back, and "Centre owner" was a link to the page you were
// already standing on.
export function CentreHeaderPills({ mayViewCourseAdmin }: { mayViewCourseAdmin: boolean }) {
  const pathname = usePathname() ?? "";
  const onOwner = pathname.startsWith("/centre/owner");

  return (
    <>
      <span className="h-[18px] w-px shrink-0 bg-border" aria-hidden="true" />
      {onOwner ? (
        <Link href="/centre" className={PILL_INACTIVE}>
          Centre management
        </Link>
      ) : (
        <span className={PILL_ACTIVE_GARNET}>Centre management</span>
      )}
      {mayViewCourseAdmin ? (
        <Link href="/dashboard/admin" className={PILL_INACTIVE}>
          Course admin
        </Link>
      ) : null}
    </>
  );
}

// The garnet Centre owner pill used to live here. It is gone: Connect is
// the way home now, and for an owner home IS the owner screen, so the pill
// was a second door to the place the mark already goes. Ramy, 31 Aug 2026:
// "you're logged in as yourself. You don't need a Centre owner pill. You
// just click on Connect, and it would take you back."
