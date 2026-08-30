"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The full-width "Centre settings" bar that sits under every Centre
// Management tab (Centre Admin.dc.html puts it after all three tab blocks,
// not inside any one of them).
//
// It lives in /centre/layout.tsx, which also wraps /centre/settings itself
// -- so the settings page was rendering a bar inviting you to open the page
// you were already on, and clicking it did nothing. Ramy, 30 Aug 2026: "it
// doesn't make much sense that while you're in centre settings you still
// have the big bar at the bottom that says open settings. And when you
// click on it, also nothing happens, because you are already there."
//
// A client component only so it can read the path; the permission decision
// stays on the server, where the layout does it before rendering this at
// all.
export function CentreSettingsCard() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/centre/settings")) return null;

  return (
    <div className="container pb-24">
      <Link
        href="/centre/settings"
        className="admin-hover-fill card flex items-center justify-between gap-4 px-[22px] py-[18px] transition-colors duration-150 hover:border-primary hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))]"
      >
        <div className="flex flex-col gap-[3px]">
          <span className="font-serif text-[15px] font-semibold text-ink">Centre settings</span>
          <span className="text-[11.5px] text-muted">
            Centre profile, Google Drive connection, payment providers, admin roles
          </span>
        </div>
        <span className="shrink-0 text-sm font-medium text-primary">Open settings &rarr;</span>
      </Link>
    </div>
  );
}
