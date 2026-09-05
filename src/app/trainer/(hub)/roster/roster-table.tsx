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
function Th({ center = false, children }: { center?: boolean; children: React.ReactNode }) {
  // Two-line labels are broken on purpose ("Assessed" over "hrs"), never
  // wherever the column width happens to fall; numbers centre under them.
  return (
    <th className={`align-bottom text-[10.5px] leading-[1.2] font-bold tracking-[0.08em] whitespace-pre-line text-muted uppercase ${center ? "text-center" : ""}`}>
      {children}
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
              <Th>{"Candidate"}</Th>
              {showContact ? <Th center>{"Email"}</Th> : <th />}
              <Th center>{"Assessed\nhrs"}</Th>
              <Th center>{"TPs"}</Th>
              <Th center>{"Assignments"}</Th>
              <Th center>{"Criteria"}</Th>
              <Th center>{"Attendance"}</Th>
              <Th center>{"Provisional"}</Th>
              <Th center>{"At\nrisk"}</Th>
              {showDetail ? (
                <>
                  <Th center>{"TP\nstages"}</Th>
                  <Th center>{"Supervised"}</Th>
                  <Th center>{"Obs.\nhrs"}</Th>
                  <Th center>{"Stage 1"}</Th>
                  <Th center>{"Stage\n2/3"}</Th>
                  <Th center>{"CELTA 5\nsign-off"}</Th>
                  <Th center>{"FOL"}</Th>
                  <Th center>{"Standing"}</Th>
                  <Th center>{"Obs.\ntasks"}</Th>
                  <Th center>{"Pre-\ncourse"}</Th>
                  <Th center>{"Filmed\nobs"}</Th>
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
