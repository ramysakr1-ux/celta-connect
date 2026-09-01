"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PILL_ACTIVE, PILL_INACTIVE } from "@/app/centre/header-pill-styles";

/**
 * The room pills for the /dashboard side: Course admin and Admissions.
 *
 * Fixed order, only the fill moving -- the rule from 31 Aug that the pills
 * must hold still, because when each section put itself first the leftmost
 * pill meant something different depending on where you already were.
 *
 * Admissions is a room in its own right. Ramy, 1 Sep 2026: "admissions could
 * be for more than one course, so they can[not] be part of Course Admin.
 * Admissions should have their own room, across the board." Before this it had
 * no pill at all, so standing in Admissions lit the COURSE ADMIN pill while
 * the rule under the header was rose -- the colour and the signage disagreeing,
 * which is worse than either being missing.
 */
export function SectionPills() {
  const pathname = usePathname() ?? "";
  const inAdmissions = pathname.startsWith("/dashboard/admissions");

  return (
    <>
      {inAdmissions ? (
        <Link href="/dashboard/admin" className={PILL_INACTIVE}>
          Course admin
        </Link>
      ) : (
        <span className={PILL_ACTIVE}>Course admin</span>
      )}
      {inAdmissions ? (
        <span className={PILL_ACTIVE}>Admissions</span>
      ) : (
        <Link href="/dashboard/admissions" className={PILL_INACTIVE}>
          Admissions
        </Link>
      )}
    </>
  );
}
