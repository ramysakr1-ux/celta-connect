"use client";

import { useState } from "react";
import { RosterRowView } from "@/app/trainer/(hub)/roster/roster-row";
import type { RosterRow } from "@/lib/roster";

// for-claude-code-roster-column-crowding.md: the spec's 6 glance columns
// (+ At risk, "load-bearing") stay always visible; everything that landed
// afterward as real features shipped (TP stages, Supervised review,
// Observation hrs, Stage 1/2/3, CELTA 5 sign-off, FOL logged, Standing) is
// genuine progress-tracking detail, not cut -- just collapsed behind a
// toggle, so nothing a trainer relies on gets removed sight-unseen, only
// decluttered by default.
export const CORE_COLUMN_COUNT = 7; // Assessed hrs, TPs, Assignments, Criteria, Attendance, Provisional, At risk
export const DETAIL_COLUMN_COUNT = 11; // TP stages, Supervised review, Observation hrs, Stage 1, Stage 2/3, CELTA 5, FOL, Standing, Obs. tasks, Pre-course, Filmed obs

// Ramy, 5 Sep 2026: "I just don't like the way those headlines are
// written... the progress detail, they're kind of too bulky." Short
// labels, small caps like every other label in the hub, allowed to wrap
// onto two lines so the detail columns stop pushing the table wide.
function Th({ right = false, children }: { right?: boolean; children: React.ReactNode }) {
  return (
    <th className={`align-bottom text-[10.5px] leading-[1.15] font-bold tracking-[0.08em] whitespace-normal text-muted uppercase ${right ? "text-right" : ""}`}>
      <span className="inline-block max-w-[7.5rem]">{children}</span>
    </th>
  );
}

export function RosterTable({
  rows,
  isMct,
  showContact,
  courseCode,
}: {
  rows: RosterRow[];
  isMct: boolean;
  showContact: boolean;
  courseCode: string;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const NAME_AND_CONTACT_COLS = 2; // name th + contact th always render (contact th is just blank when hidden)
  const totalColCount = NAME_AND_CONTACT_COLS + CORE_COLUMN_COUNT + (showDetail ? DETAIL_COLUMN_COUNT : 0);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        aria-pressed={showDetail}
        title="TP stages, observation hours, stage sign-offs, FOL, standing"
        className={`trainer-hover self-start rounded-full border border-border px-3.5 py-1.5 text-[12.5px] font-semibold ${showDetail ? "bg-card-inset text-ink" : "bg-card text-muted"}`}
      >
        {showDetail ? "Hide progress detail" : "Show progress detail"}
      </button>
      <div className="sheet overflow-x-auto !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <Th>Candidate</Th>
              {showContact ? <Th right>Email</Th> : <th />}
              <Th right>Assessed hrs</Th>
              <Th right>TPs</Th>
              <Th right>Assignments</Th>
              <Th right>Criteria</Th>
              <Th right>Attendance</Th>
              <Th right>Provisional</Th>
              <Th right>At risk</Th>
              {showDetail ? (
                <>
                  <Th right>TP stages</Th>
                  <Th right>Supervised</Th>
                  <Th right>Obs. hrs</Th>
                  <Th right>Stage 1</Th>
                  <Th right>Stage 2/3</Th>
                  <Th right>CELTA 5</Th>
                  <Th right>FOL</Th>
                  <Th right>Standing</Th>
                  <Th right>Obs. tasks</Th>
                  <Th right>Pre-course</Th>
                  <Th right>Filmed obs</Th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <RosterRowView
                  key={row.id}
                  row={row}
                  isMct={isMct}
                  showContact={showContact}
                  courseCode={courseCode}
                  showDetail={showDetail}
                />
              ))
            ) : (
              <tr>
                <td colSpan={totalColCount} className="text-muted">
                  No trainees on this course yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
