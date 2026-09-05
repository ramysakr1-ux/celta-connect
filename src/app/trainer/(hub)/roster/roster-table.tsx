"use client";

import { useEffect, useState } from "react";
import { RosterRowView, ROSTER_COLS } from "@/app/trainer/(hub)/roster/roster-row";
import type { RosterRow } from "@/lib/roster";
import { isCourseStatusReadOnly } from "@/lib/course-status";

// for-claude-code-roster-column-crowding.md: the spec's glance columns
// stay always visible; everything that landed afterward as real features
// shipped (TP stages, Supervised review, Observation hrs, Stage 1/2/3,
// CELTA 5 sign-off, FOL logged, Standing) is genuine progress-tracking
// detail, not cut -- just behind a switch. design_handoff_trainer_roster_v2
// is the layout: four summary tiles that filter, visual cells, a Flags
// column.

const STORAGE_KEY = "connect.roster.progress-detail";

type Filter = "risk" | "resub" | "ontrack" | "passab";

const TILE_STYLE: Record<Filter, React.CSSProperties> = {
  risk: { background: "oklch(94% 0.043 25)", borderColor: "oklch(85% 0.06 25)", color: "oklch(45% 0.15 27)" },
  resub: { background: "oklch(93% 0.05 80)", borderColor: "oklch(84% 0.08 78)", color: "oklch(40% 0.09 68)" },
  ontrack: { background: "oklch(93% 0.019 190)", borderColor: "oklch(84% 0.04 190)", color: "oklch(32% 0.05 195)" },
  passab: { background: "var(--color-card)", borderColor: "var(--color-border)", color: "var(--color-ink-warm)" },
};

function isPassAB(row: RosterRow): boolean {
  return Boolean(row.provisionalLabel && /Pass [AB]/.test(row.provisionalLabel));
}

function matches(row: RosterRow, filter: Filter): boolean {
  switch (filter) {
    case "risk":
      return row.atRiskReasons.length > 0;
    case "resub":
      return row.resubmissionPending;
    case "ontrack":
      return row.atRiskReasons.length === 0;
    case "passab":
      return isPassAB(row);
  }
}

function Th({ align = "left", children }: { align?: "left" | "right"; children?: React.ReactNode }) {
  return <div className={align === "right" ? "text-right" : ""}>{children}</div>;
}

export function RosterTable({
  rows,
  isMct,
  showContact,
  courseCode,
  frozenSubById,
  weekLabel,
  leading,
}: {
  rows: RosterRow[];
  isMct: boolean;
  showContact: boolean;
  courseCode: string;
  /** Sub-line for frozen rows, by candidate id ("Left week 2 · record kept"). */
  frozenSubById: Record<string, string>;
  /** "week 3 of 4", for the Pass A / B tile. */
  weekLabel: string | null;
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

  // Summary counts exclude withdrawn/deferred candidates (handoff).
  const [filter, setFilter] = useState<Filter | null>(null);
  const active = rows.filter((r) => !isCourseStatusReadOnly(r.courseStatus));
  const tiles: { key: Filter; n: number; label: string; sub: string }[] = [
    { key: "risk", n: active.filter((r) => matches(r, "risk")).length, label: "At risk", sub: "attendance, hours or criteria" },
    { key: "resub", n: active.filter((r) => matches(r, "resub")).length, label: "Resubmissions", sub: "assignments to re-mark" },
    { key: "ontrack", n: active.filter((r) => matches(r, "ontrack")).length, label: "On track", sub: `of ${active.length} active candidate${active.length === 1 ? "" : "s"}` },
    { key: "passab", n: active.filter((r) => matches(r, "passab")).length, label: "Pass A / B", sub: weekLabel ? `provisional, ${weekLabel}` : "provisional" },
  ];
  const shown = filter ? rows.filter((r) => !isCourseStatusReadOnly(r.courseStatus) && matches(r, filter)) : rows;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={filter === t.key}
            onClick={() => setFilter((f) => (f === t.key ? null : t.key))}
            title={filter === t.key ? "Click again to show everyone" : `Show only ${t.label.toLowerCase()}`}
            className="flex items-center gap-3.5 rounded-[12px] border px-[18px] py-3.5 text-left transition-shadow"
            style={{
              ...TILE_STYLE[t.key],
              boxShadow: filter === t.key ? "inset 0 0 0 1px var(--hub-accent), 0 1px 2px oklch(0% 0 0 / 0.04)" : "0 1px 2px oklch(0% 0 0 / 0.04)",
            }}
          >
            <span className="font-serif text-[30px] leading-none font-semibold tabular-nums">{t.n}</span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold">{t.label}</span>
              <span className="text-[11.5px] text-muted">{t.sub}</span>
            </span>
          </button>
        ))}
      </div>

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
          <span className="relative block h-3.5 w-[26px] shrink-0 rounded-full transition-colors duration-150" style={{ background: showDetail ? "var(--hub-accent)" : "oklch(80% 0.014 82)" }}>
            <span className="absolute top-0.5 block size-2.5 rounded-full bg-card transition-[left] duration-150" style={{ left: showDetail ? 14 : 2 }} />
          </span>
          {showDetail ? "Progress detail on" : "Show progress detail"}
        </button>
      </div>

      {/* The only shadowed card on the page (handoff, "Roster table"). */}
      <div className="overflow-x-auto rounded-[14px] border border-border bg-card" style={{ boxShadow: "0 1px 2px oklch(0% 0 0 / 0.04), 0 8px 24px oklch(30% 0.04 58 / 0.06)" }}>
        <div className="min-w-[1120px]">
          <div className={`${ROSTER_COLS} items-end border-b border-border px-4 pt-3.5 pb-2.5 text-[10.5px] leading-[1.2] font-bold tracking-[0.08em] text-muted uppercase`}>
            <Th>Candidate</Th>
            <Th>TPs passed · of 8</Th>
            <Th>Assessed hrs</Th>
            <Th>Assignments</Th>
            <Th>Criteria met</Th>
            <Th>Attendance</Th>
            <Th>Provisional</Th>
            <Th>Flags</Th>
            <Th align="right">{showContact ? "Contact" : null}</Th>
          </div>
          {shown.length > 0 ? (
            shown.map((row) => (
              <RosterRowView key={row.id} row={row} isMct={isMct} showContact={showContact} courseCode={courseCode} showDetail={showDetail} frozenSub={frozenSubById[row.id]} />
            ))
          ) : (
            <p className="px-5 py-4 text-sm text-muted">{filter ? "Nobody in this set. Click the tile again to show everyone." : "No trainees on this course yet."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
