"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Exactly three, left-aligned under the header, in this order -- the layout
// spec is explicit. Everything else a centre administrator needs is reached
// from within a panel (the pipeline links into Admissions) or from the Centre
// settings bar at the foot of the page, not from here.
const TABS = [
  { href: "/centre", label: "Overview" },
  { href: "/centre/roles", label: "Roles" },
  { href: "/centre/import", label: "Import" },
] as const;

export function CentreTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 border-b border-border pb-0.5">
      {TABS.map((tab) => {
        // Overview is the index, so it needs an exact match or every deeper
        // route would light it up too.
        const active = tab.href === "/centre" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-[3px] border-b-2 px-3 pb-2 text-sm font-medium ${
              active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
