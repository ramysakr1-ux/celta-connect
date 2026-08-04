"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Roster", external: false },
  { href: "/timetable", label: "Timetable", external: false },
  { href: "/volunteers", label: "Volunteers", external: false },
  { href: "/dashboard/trainer/rotation", label: "TP Rotation", external: true },
  { href: "/dashboard/trainer/coursebooks", label: "TP Points Library", external: true },
] as const;

export function TrainerTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-card">
      <div className="container flex gap-8">
        {TABS.map((tab) => {
          const href = tab.external ? tab.href : `/trainer${tab.href}`;
          const active = tab.external ? false : tab.href === "" ? pathname === "/trainer" : pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              className={`border-b-2 py-3 text-sm font-medium ${
                active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
