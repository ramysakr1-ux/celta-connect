"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Course Stream" },
  { href: "/resources", label: "Resource Hub" },
  { href: "/tp", label: "TP Hub" },
  { href: "/assignments", label: "Written Assignments" },
  { href: "/celta5", label: "CELTA 5" },
] as const;

export function PortfolioTabs({ traineeId }: { traineeId: string }) {
  const pathname = usePathname();
  const base = `/portfolio/${traineeId}`;

  return (
    <div className="border-b border-border bg-card">
      <div className="container flex gap-8">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              className={`border-b-2 py-3 text-sm font-medium ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-ink"
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
