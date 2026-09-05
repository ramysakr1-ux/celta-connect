"use client";

import { useEffect, useState } from "react";
import { RosterRowView, ROSTER_COLS } from "@/app/trainer/(hub)/roster/roster-row";
import type { RosterRow } from "@/lib/roster";

// for-claude-code-roster-column-crowding.md: the spec's 6 glance columns
// (+ At risk, "load-bearing") stay always visible; everything that landed
// afterward as real features shipped (TP stages, Supervised review,
// Observation hrs, Stage 1/2/3, CELTA 5 sign-off, FOL logged, Standing) is
// genuine progress-tracking detail, not cut -- just behind a switch, so
// nothing a trainer relies on gets removed sight-unseen, only decluttered
// by default. design_handoff_trainer_roster is the layout.

const STORAGE_KEY = "connect.roster.progress-detail";

function Th({ align = "center", children }: { align?: "left" | "center" | "right"; children?: React.ReactNode }) {
  return <div className={align === "left" ? "" : align === "right" ? "text-right" : "text-center"}>{children}</div>;
}

export function RosterTable({
  rows,
  isMct,
  showContact,
  courseCode,
  frozenSubById,
  leading,
}: {
  rows: RosterRow[];
  isMct: boolean;
  showContact: boolean;
  courseCode: string;
  /** Sub-line for frozen rows, by candidate id ("Left week 2 · record kept"). */
  frozenSubById: Record<string, string>;
  /** What sits on the left of the controls row (the FOL pool pill). */
  leading?: React.ReactNode;
}) {
  // Off until the browser says otherwise -- read after mount so the server
  // and first client render agree (no stored value on the server).
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setShowDetail(true);
    } catch {
      /* private mode etc. -- the switch still works, it just won't remember */
    }
  }, []);
  const toggle = () =>
    setShowDetail((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* see above */
      }
      return next;
    });

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{leading}</div>
        <button
          type="button"
          role="switch"
          aria-checked={showDetail}
          onClick={toggle}
          title="TP stages, observation hours, stage sign-offs, FOL, standing"
          className={`trainer-hover inline-flex h-8 items-center gap-2 rounded-full border border-border px-3.5 text-[12.5px] font-semibold ${
            showDetail ? "text-ink" : "bg-card text-muted"
          }`}
          style={showDetail ? { background: "color-mix(in oklab, var(--hub-accent) 8%, var(--color-card))" } : undefined}
        >
          <span
            className="relative block h-3.5 w-[26px] shrink-0 rounded-full transition-colors duration-150"
            style={{ background: showDetail ? "var(--hub-accent)" : "oklch(80% 0.014 82)" }}
          >
            <span
              className="absolute top-0.5 block size-2.5 rounded-full bg-card transition-[left] duration-150"
              style={{ left: showDetail ? 14 : 2 }}
            />
          </span>
          {showDetail ? "Progress detail on" : "Show progress detail"}
        </button>
      </div>

      {/* The only shadowed card on the page (handoff, "Roster table"). */}
      <div
        className="overflow-x-auto rounded-[14px] border border-border bg-card"
        style={{ boxShadow: "0 1px 2px oklch(0% 0 0 / 0.04), 0 8px 24px oklch(30% 0.04 58 / 0.06)" }}
      >
        <div className="min-w-[1040px]">
          <div
            className={`${ROSTER_COLS} items-end border-b border-border px-5 pt-3.5 pb-2.5 text-[10.5px] leading-[1.2] font-bold tracking-[0.08em] text-muted uppercase`}
          >
            <Th align="left">Candidate</Th>
            <Th>
              Assessed
              <br />
              hrs
            </Th>
            <Th>TPs</Th>
            <Th>Assignments</Th>
            <Th>Criteria</Th>
            <Th>Attendance</Th>
            <Th>Provisional</Th>
            <Th>At risk</Th>
            <Th align="right">{showContact ? "Contact" : null}</Th>
          </div>
          {rows.length > 0 ? (
            rows.map((row) => (
              <RosterRowView
                key={row.id}
                row={row}
                isMct={isMct}
                showContact={showContact}
                courseCode={courseCode}
                showDetail={showDetail}
                frozenSub={frozenSubById[row.id]}
              />
            ))
          ) : (
            <p className="px-5 py-4 text-sm text-muted">No trainees on this course yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
