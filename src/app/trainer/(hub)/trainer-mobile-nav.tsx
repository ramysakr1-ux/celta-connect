"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// specs/build-spec.md §7, restated by the high-traffic audit (16 Sep 2026,
// A7): a phone gets status and the one or two decisions only that person can
// make; laptop-only tasks say so. For a tutor that is four doors -- Today
// (what's on, who needs you, Join), Capture (already phone-first, mid-lesson),
// Announcements and the Roster to read. Everything else in the hub is behind
// HubPhoneGate. Same chrome shape as the trainee's bar: fixed to the bottom,
// one door per column, safe-area padding for the iOS home indicator, gone at
// md where the tab strip takes over.
export const TRAINER_PHONE_DOORS = [
  { href: "/trainer", label: "Today", exact: true },
  { href: "/trainer/capture", label: "Capture", exact: false },
  { href: "/trainer/announcements", label: "Announcements", exact: false },
  { href: "/trainer/roster", label: "Roster", exact: false },
] as const;

export function isPhoneDoor(pathname: string): boolean {
  return TRAINER_PHONE_DOORS.some((d) => (d.exact ? pathname === d.href : pathname.startsWith(d.href)));
}

export function TrainerMobileNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Trainer hub, phone"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TRAINER_PHONE_DOORS.map((door) => {
        const active = door.exact ? pathname === door.href : pathname.startsWith(door.href);
        return (
          <Link
            key={door.href}
            href={door.href}
            className={`flex h-14 flex-col items-center justify-center gap-0.5 text-center text-micro leading-tight font-medium ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
            {door.label}
          </Link>
        );
      })}
    </nav>
  );
}
