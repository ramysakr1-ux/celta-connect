"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "", label: "Course Stream", metaKey: "courseStream" },
  { href: "/pre-course-task", label: "Pre-course task", metaKey: "preCourseTask" },
  { href: "/resources", label: "Resource Hub", metaKey: "resourceHub" },
  { href: "/tp", label: "Teaching Practice", metaKey: "tp" },
  { href: "/assignments", label: "Written Assignments", metaKey: "assignments" },
  { href: "/celta5", label: "CELTA 5", metaKey: "celta5" },
  // for-claude-code-progress-tab.md's decision: its own persistent tab, not
  // folded into CELTA 5 or Teaching Practice -- self-assessment, sign-off,
  // and observation hours need to be reliably findable, not buried behind
  // "waiting on you" links. Last position, per for-claude-code-progress-tab-
  // build.md's tab order.
  { href: "/progress", label: "Progress", metaKey: "progress" },
] as const;

export interface PortfolioSidebarMeta {
  // "" (blank) is a deliberate choice for anything with no real data model
  // yet -- checkpoint 2 explicitly avoids fabricating a "N new" style count
  // where there's no read-tracking to back it (see courseStream/resourceHub).
  courseStream: string;
  preCourseTask: string;
  resourceHub: string;
  tp: string;
  assignments: string;
  celta5: string;
  progress: string;
}

// Was a horizontal top tab bar; checkpoint 2 (App Redesign.dc.html 1d)
// moves this into a 232px left sidebar with a meta count per item. Kept the
// filename/TABS shape as the source of truth to avoid an import-path churn
// across the layout.
export function PortfolioTabs({ traineeId, meta }: { traineeId: string; meta: PortfolioSidebarMeta }) {
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
      <p className="px-3 pb-2.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Workspace</p>
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
            className={`flex items-center justify-between gap-2.5 rounded-[6px] border-l-[3px] px-3 py-2.5 text-sm ${
              active
                ? "border-primary bg-accent/40 font-semibold text-ink"
                : "border-transparent text-muted hover:bg-accent/20"
            }`}
          >
            <span>{tab.label}</span>
            {metaValue ? <span className="text-xs tabular-nums text-muted">{metaValue}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
