"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeRoomKey } from "@/components/room-pills";

// The pages inside Centre Management, sitting under the room's own pill.
//
// Was Overview / Roles / Import, rendered on every /centre/* route. Three
// things were wrong with that, and Ramy called all three on 1 Sep 2026:
//
//   - Overview is the room's landing page, which the dropped pill already
//     takes you to. "Overview is just a landing page for centre management.
//     So we don't really need to have a tab named overview anymore."
//   - Import creates applicants and volunteers, which belong to the
//     Admissions room and the Volunteer pool. It is not a Centre Management
//     job and is moving to those two rooms.
//   - Settings -- five sub-tabs, ownership transfer, deleting the centre --
//     had no tab at all. It was reached from a bar pinned to the foot of
//     every page in the room, which is one door appearing eight times.
//
// So: Roles and Settings, the two things that describe the centre as a
// whole. Nothing here is a verb.
const TABS = [
  { href: "/centre/roles", label: "Roles" },
  { href: "/centre/settings", label: "Settings" },
] as const;

export function CentreTabs({ canSettings }: { canSettings: boolean }) {
  const pathname = usePathname() ?? "";

  // Only inside Centre Management. This nav used to render on every route
  // the layout wrapped, so the centre owner's screen and the volunteer pool
  // -- neither of which is this room -- carried another room's page
  // navigation. activeRoomKey() is the same answer the pills use, so the
  // tabs and the pill beneath can never disagree about which room this is.
  if (activeRoomKey(pathname) !== "centre") return null;

  // Roles is readable by anyone holding a centre role: "who holds what" is a
  // record, and the Centre observer is defined as read-only across the whole
  // centre. Settings follows the capability its own page enforces, so the
  // row never offers a door that opens onto nothing.
  const tabs = TABS.filter((t) => t.href !== "/centre/settings" || canSettings);
  if (tabs.length === 0) return null;

  return (
    <nav className="flex gap-2 border-b border-border pb-0.5">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-[3px] border-b-2 px-3 pb-2 text-sm font-medium transition-colors duration-150 ${
              active ? "border-primary text-primary" : "border-transparent text-muted hover:border-primary/40 hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
