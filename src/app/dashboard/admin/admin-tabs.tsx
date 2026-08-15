"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Ramy, live-testing the preview 2026-08-15: the admin home page's own
// "Admissions / TP Points Library / Settings" links (admin/page.tsx) lived
// only in that page's own content, not the shared dashboard/layout.tsx
// header -- so they vanished the moment you clicked into any of them, with
// no way back except the browser's own back button. This makes them a real
// persistent nav instead, same pattern as the trainer hub's TrainerTabs.
const TABS = [
  { href: "/admin", label: "Admin" },
  { href: "/admissions", label: "Admissions" },
  { href: "/admin/coursebooks", label: "TP Points Library" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full items-center gap-6">
      {TABS.map((tab) => {
        const href = `/dashboard${tab.href}`;
        const active = tab.href === "/admin" ? pathname === href : pathname.startsWith(href);
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
