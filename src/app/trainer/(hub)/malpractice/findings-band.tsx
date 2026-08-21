"use client";

import { markFindingReviewed } from "@/app/trainer/(hub)/malpractice/actions";
import { OpenCaseButton } from "@/app/trainer/(hub)/malpractice/open-case-button";

export interface FindingView {
  id: string;
  sectionKey: string;
  matchedText: string;
  matchLength: number;
  sourceType: "same_course" | "cross_course_archive" | "brief" | "model_answer";
  sourceCourseLabel: string | null;
  reviewedAt: string | null;
}

// build-spec.md: "a quiet band above the first section naming the match,
// its length and its source, with the passage highlighted inline... Never
// a similarity percentage." Only ever rendered here -- on the assignment
// itself, to the tutor marking it. Never a roster badge, never an email.
export function FindingsBand({
  findings,
  assignmentId,
  round,
  traineeId,
}: {
  findings: FindingView[];
  assignmentId: string;
  round: "first" | "resubmission";
  traineeId: string;
}) {
  const unreviewed = findings.filter((f) => !f.reviewedAt);
  if (unreviewed.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {unreviewed.map((f) => (
        <div key={f.id} className="rounded-[6px] border border-status-warning-text/40 bg-status-warning-bg p-4">
          <p className="text-sm font-semibold text-ink">
            Scanner match in &quot;{f.sectionKey}&quot; -- {f.matchLength} words,{" "}
            {f.sourceType === "same_course"
              ? "another submission on this course"
              : f.sourceType === "cross_course_archive"
                ? `an archived submission from ${f.sourceCourseLabel ?? "a previous course"}`
                : "another source"}
            .
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-[6px] bg-card p-3 text-sm text-ink">&quot;{f.matchedText}&quot;</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={markFindingReviewed}>
              <input type="hidden" name="finding_id" value={f.id} />
              <input type="hidden" name="assignment_id" value={assignmentId} />
              <input type="hidden" name="trainee_id" value={traineeId} />
              <button
                type="submit"
                className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary"
              >
                Mark reviewed -- not a concern
              </button>
            </form>
            <OpenCaseButton assignmentId={assignmentId} round={round} findingId={f.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
