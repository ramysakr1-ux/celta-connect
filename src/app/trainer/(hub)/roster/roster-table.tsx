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
const CORE_COLUMN_COUNT = 7; // Assessed hrs, TPs, Assignments, Criteria, Attendance, Provisional, At risk
const DETAIL_COLUMN_COUNT = 10; // TP stages, Supervised review, Observation hrs, Stage 1, Stage 2/3, CELTA 5, FOL, Standing, Obs. tasks, Pre-course

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
        className="self-start text-xs font-medium text-primary hover:underline"
      >
        {showDetail
          ? "Hide progress detail ↑"
          : "Show progress detail -- TP stages, observation hours, stage sign-offs, FOL, standing →"}
      </button>
      <div className="sheet overflow-x-auto !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Candidate</th>
              {showContact ? <th className="text-right text-sm text-muted">Outside Connect -- urgent only</th> : <th />}
              <th className="text-right text-sm text-muted">Assessed hrs</th>
              <th className="text-right text-sm text-muted">TPs passed</th>
              <th className="text-right text-sm text-muted">Assignments</th>
              <th className="text-right text-sm text-muted">Criteria</th>
              <th className="text-right text-sm text-muted">Attendance</th>
              <th className="text-right text-sm text-muted">Provisional</th>
              <th className="text-right text-sm text-muted">At risk</th>
              {showDetail ? (
                <>
                  <th className="text-right text-sm text-muted">TP stages</th>
                  <th className="text-right text-sm text-muted">Supervised review</th>
                  <th className="text-right text-sm text-muted">Observation hrs</th>
                  <th className="text-right text-sm text-muted">Stage 1 report</th>
                  <th className="text-right text-sm text-muted">Stage 2 / 3</th>
                  <th className="text-right text-sm text-muted">CELTA 5 sign-off</th>
                  <th className="text-right text-sm text-muted">FOL logged</th>
                  <th className="text-right text-sm text-muted">Standing</th>
                  <th className="text-right text-sm text-muted">Obs. tasks</th>
                  <th className="text-right text-sm text-muted">Pre-course</th>
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
