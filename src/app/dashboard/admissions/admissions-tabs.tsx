"use client";

import { RoomTabs, RoomTabLink } from "@/components/room-tabs";
import { usePathname } from "next/navigation";

/**
 * The pages inside Admissions, sitting under the room's own pill.
 *
 * Until now this room had no navigation at all. Its five pages were listed
 * once, as plain text links, in the header of the landing page -- and not
 * one of them repeated the list, so every one of them was a dead end: you
 * arrived at Referral requests and the only way onward was the browser's
 * back button.
 *
 * The same component as Centre Management's tabs since 16 Sep 2026 (B4),
 * having been the same markup copied: a room is a room.
 * No "Overview" tab, because the dropped pill above already goes there.
 *
 * Email delivery is not here. Ramy, 1 Sep 2026, on six tabs being too many:
 * it is a delivery log rather than a daily job, so it lives inside Settings
 * with the other things you set once and check occasionally.
 */
const TABS = [
  { href: "/dashboard/admissions/pipeline", label: "Pipeline" },
  { href: "/dashboard/admissions/this-week", label: "This week" },
  { href: "/dashboard/admissions/referral-requests", label: "Referrals" },
  { href: "/dashboard/admissions/import", label: "Import" },
  { href: "/dashboard/admissions/settings", label: "Settings" },
] as const;

export function AdmissionsTabs() {
  const pathname = usePathname() ?? "";

  return (
    <RoomTabs>
      {TABS.map((tab) => (
        <RoomTabLink key={tab.href} href={tab.href} active={pathname.startsWith(tab.href)}>
          {tab.label}
        </RoomTabLink>
      ))}
    </RoomTabs>
  );
}
