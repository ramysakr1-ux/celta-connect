"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { WORKSPACE_TABS } from "@/app/portfolio/[traineeId]/workspace-tabs";

// A1, 16 Sep 2026: this list had seven doors where the candidate's own rail
// has five -- it kept Pre-course task (dropped from the rail 28 Aug) and
// Progress (retired 29 Aug). Staff and candidate see the same rooms now.
const TABS = WORKSPACE_TABS;

export interface PortfolioSidebarMeta {
  // "" (blank) is a deliberate choice for anything with no real data model
  // yet -- checkpoint 2 explicitly avoids fabricating a "N new" style count
  // where there's no read-tracking to back it (see courseStream/resourceHub).
  courseStream: string;
  resourceHub: string;
  tp: string;
  assignments: string;
  celta5: string;
}

// Was a horizontal top tab bar; checkpoint 2 (App Redesign.dc.html 1d --
// see the note in trainer/(hub)/page.tsx: that file is not in the archive)
// moves this into a 232px left sidebar with a meta count per item. Kept the
// filename/TABS shape as the source of truth to avoid an import-path churn
// across the layout.
export function PortfolioTabs({
  traineeId,
  meta,
  firstTabLabel,
}: {
  traineeId: string;
  meta: PortfolioSidebarMeta;
  /**
   * An assessor's first tab is the portfolio landing, not the candidate's
   * Course Stream (see assessor-landing.tsx), so the rail must not still call
   * it Course Stream while showing something else.
   */
  firstTabLabel?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/portfolio/${traineeId}`;
  // Preserve ?preview=trainee across tab switches -- confirmed live, without
  // this every tab click silently dropped a staff member back into full
  // staff view, so they had to re-click "Trainee view" in the pill after
  // every single tab. Only this one param is meaningful here, so a plain
  // string append is enough rather than cloning the whole search string.
  const isPreviewingAsTrainee = searchParams.get("preview") === "trainee";
  const previewSuffix = isPreviewingAsTrainee ? "?preview=trainee" : "";

  return (
    <nav className="flex w-[232px] shrink-0 flex-col gap-0.5 py-1">
      <p className="px-3 pb-2.5 text-micro font-semibold tracking-[0.12em] text-muted uppercase">Workspace</p>
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = tab.href === "" ? pathname === base : pathname.startsWith(href);
        // celta5's meta is a staff-only figure (see layout.tsx's comment on
        // criteriaPctMeta) -- computed server-side off the real session, so
        // it has to be hidden client-side here during preview, same
        // treatment as the header's trajectory pill (HideDuringPreview).
        const metaValue = tab.metaKey === "celta5" && isPreviewingAsTrainee ? "" : meta[tab.metaKey];
        return (
          <Link
            key={tab.href}
            href={`${href}${previewSuffix}`}
            className={`flex items-center justify-between gap-2.5 rounded-[6px] border-l-[3px] px-3 py-2.5 text-body ${
              active
                ? "border-primary bg-accent/40 font-semibold text-ink"
                : "border-transparent text-muted hover:bg-accent/20"
            }`}
          >
            <span>{tab.href === "" && firstTabLabel ? firstTabLabel : tab.label}</span>
            {metaValue ? <span className="text-label tabular-nums text-muted">{metaValue}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
