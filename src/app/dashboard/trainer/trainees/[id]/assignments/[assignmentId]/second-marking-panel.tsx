import { recordSecondMarking } from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";
import { formatDate } from "@/lib/format-date";

// Handbook §9.2.3: "A proportion of each assignment must be double-marked.
// This involves checking the first marker's grading and comments... The
// sample checked should include any fail assignments. Assignments that have
// been double-marked should be initialled by both tutors. Centres should keep
// a record of which assignments have been double-marked; course assessors may
// ask to see this record."
//
// Until 12 Sep 2026 the only way to record a second marker was the dropdown
// on a RESUBMISSION decision -- the first marker naming someone else. A
// first-round pass, which is most of the sample the quota counts, could only
// be double-marked by the seed. This is the second tutor's own initial: they
// open the marked work, check the grading and comments, and sign it here as
// themselves. Actor and time are the record (shared access leaves a footprint).
export function SecondMarkingPanel({
  assignmentId,
  traineeId,
  viewerId,
  markerId,
  markerName,
  secondMarkerId,
  secondMarkerName,
  secondMarkerRecordedAt,
  decided,
  failed,
  timeZone,
  garnet = false,
}: {
  assignmentId: string;
  traineeId: string;
  viewerId: string;
  markerId: string | null;
  markerName: string | null;
  secondMarkerId: string | null;
  secondMarkerName: string | null;
  secondMarkerRecordedAt: string | null;
  /** The current round has a decision on it -- there is a grading to check. */
  decided: boolean;
  /** Fails must be in the sample (§9.2.3), so an un-double-marked fail is said louder. */
  failed: boolean;
  timeZone: string;
  garnet?: boolean;
}) {
  const isFirstMarker = Boolean(markerId) && markerId === viewerId;
  const done = Boolean(secondMarkerId && secondMarkerRecordedAt);

  return (
    <div className={`sheet flex flex-col gap-1.5 ${garnet ? "sheet-garnet" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Double-marking</p>
        <span className="text-[10px] font-semibold text-muted tabular-nums">§9.2.3</span>
      </div>
      {done ? (
        <p className="text-sm text-ink">
          Second-marked by <span className="font-semibold">{secondMarkerName ?? "a second tutor"}</span>
          {secondMarkerRecordedAt ? ` on ${formatDate(secondMarkerRecordedAt, timeZone, { year: "numeric" })}` : ""}
          {markerName ? `, first marked by ${markerName}` : ""}. Both initials are on the record the assessor may ask for.
        </p>
      ) : !decided ? (
        <p className="text-sm text-muted">Nothing to check yet -- double-marking follows the first marker&apos;s decision.</p>
      ) : isFirstMarker ? (
        <p className="text-sm text-muted">
          Not double-marked yet. {failed ? "A fail must be in the double-marked sample -- " : ""}
          A second tutor opens this assignment, checks your grading and comments, and signs it as themselves.
        </p>
      ) : (
        <form action={recordSecondMarking} className="flex flex-wrap items-center justify-between gap-3">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <input type="hidden" name="trainee_id" value={traineeId} />
          <p className="text-sm text-muted">
            {failed ? "A fail must be in the double-marked sample. " : ""}
            {markerName ? `${markerName} marked this.` : "Marked."} Check the grading and the comments, then sign here as the second marker.
          </p>
          <button type="submit" className="shrink-0 rounded-[6px] border border-border px-3.5 py-2 text-sm font-medium text-ink trainee-hover-fill">
            Record my second marking
          </button>
        </form>
      )}
    </div>
  );
}
