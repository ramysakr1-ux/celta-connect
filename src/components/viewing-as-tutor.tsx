"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { usePathname } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { labelForPath } from "@/lib/portfolio-page-label";
import { WORKSPACE_TABS, isTabActive } from "@/app/portfolio/[traineeId]/workspace-tabs";

// MCT polish pass §10: a candidate's page opens in the TRAINER's frame, and a
// thin strip under the trainer's own header names whose page it is.
//
// The spec's own example is "Viewing as tutor · Sara Yılmaz · Assignment 2
// (LRT), round 1". The page half comes from the shared labeller the assessor's
// read-only banner uses, so the same record is called the same thing whoever
// is standing on it.
//
// Not sticky, unlike the assessor's: that one is a permission notice an
// assessor needs mid-scroll on a long report. This is orientation, it sits
// directly under the header the trainer already knows, and the back link is
// the trainer's own nav a few pixels above it.
export function ViewingAsTutor({
  traineeName,
  traineeId,
  back,
  actions,
  pills,
}: {
  traineeName: string;
  traineeId: string;
  /** Where the trainer came from -- the roster unless the link said otherwise. */
  back: { href: string; label: string };
  /** The trainer's own actions for this candidate, in the trainer's own bar. */
  actions?: React.ReactNode;
  /** Facts a tutor needs about this candidate: withdrawn, tracking, arrangements. */
  pills?: React.ReactNode;
}) {
  const pathname = usePathname();
  const pageLabel = labelForPath(pathname);
  const base = `/portfolio/${traineeId}`;

  return (
    <div className="border-b border-border bg-card">
      <div className="container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <BackLink href={back.href} label={back.label} />
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
          <span className="shrink-0 rounded px-2 py-0.5 text-micro font-bold tracking-[0.08em] text-muted uppercase">
            Viewing as tutor
          </span>
          <span className="min-w-0 truncate text-body text-ink">
            <span className="font-semibold">{traineeName}</span>
            <span className="text-muted"> · {pageLabel}</span>
          </span>
          {pills}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Link
            href={`/portfolio/${traineeId}?preview=trainee`}
            className="wash flex shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-label font-medium text-ink"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            Preview as trainee
          </Link>
        </div>
      </div>

      {/* §10 removes the candidate's side panel, and the doors have to land
          somewhere: a tutor moving between this candidate's teaching record,
          assignments and CELTA 5 had only the sidebar to do it with, and the
          trainer's own tab row is about the COURSE, not this person. So the
          candidate's five rooms ride here, in the trainer's bar, from the same
          list the candidate's own rail reads -- the two cannot drift.
          Flagged rather than left silent: §10 assumes each record is entered
          fresh from a trainer-side list, and this app has no such list for
          CELTA 5 or the TP record. */}
      <div className="container -mt-0.5 flex gap-1 overflow-x-auto pb-2">
        {WORKSPACE_TABS.map((tab) => {
          const active = isTabActive(pathname, base, tab);
          return (
            <Link
              key={tab.href}
              href={`${base}${tab.href}`}
              className={`wash shrink-0 rounded-[6px] px-2.5 py-1 text-label font-semibold whitespace-nowrap ${
                active ? "bg-accent text-ink" : "text-muted hover:text-ink"
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
