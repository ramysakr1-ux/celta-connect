"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "", label: "Course Stream" },
  { href: "/resources", label: "Resource Hub" },
  { href: "/tp", label: "TP Hub" },
  { href: "/assignments", label: "Written Assignments" },
  { href: "/celta5", label: "CELTA 5" },
] as const;

export function PortfolioTabs({ traineeId }: { traineeId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/portfolio/${traineeId}`;
  // Preserve ?preview=trainee across tab switches -- confirmed live, without
  // this every tab click silently dropped a staff member back into full
  // staff view, so they had to re-click "Trainee view" in the pill after
  // every single tab. Only this one param is meaningful here, so a plain
  // string append is enough rather than cloning the whole search string.
  const previewSuffix = searchParams.get("preview") === "trainee" ? "?preview=trainee" : "";

  return (
    <div className="border-b border-border bg-card">
      <div className="container flex gap-8">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={`${href}${previewSuffix}`}
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
