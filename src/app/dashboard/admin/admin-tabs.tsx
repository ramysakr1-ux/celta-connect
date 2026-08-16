"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminTab } from "@/lib/auth/admin-tabs";

// Ramy, live-testing the preview 2026-08-15: the admin home page's own
// "Admissions / TP Points Library / Settings" links lived only in that page's
// own content, not the shared header -- so they vanished the moment you
// clicked into any of them, with no way back except the browser's own back
// button. This makes them a real persistent nav instead.
//
// Which tabs exist is decided server-side by visibleAdminTabs (lib/auth/
// admin-tabs.ts) from the Centre Admin permission layer, and passed in. This
// component only renders and highlights them.
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full items-center gap-6">
      {tabs.map((tab) => {
        const href = `/dashboard${tab.href}`;
        // Exact match for the two index routes, otherwise every deeper page
        // would light up its parent too -- /centre/roles would mark Overview
        // active, and /admin/import would mark Course admin active.
        const exact = tab.href === "/admin" || tab.href === "/centre";
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={`flex h-full items-center border-b-2 text-sm font-medium ${
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
