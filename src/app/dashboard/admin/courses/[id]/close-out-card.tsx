"use client";

import { useActionState } from "react";
import {
  initiateCloseOut,
  exportCloseOut,
  confirmCloseOutReceipt,
  extendGracePeriod,
  toggleCambridgeGradesConfirmed,
  type FormState,
} from "@/app/dashboard/admin/courses/[id]/close-out-actions";
import type { CloseOutVerificationReport, CourseCloseOutStatus } from "@/lib/supabase/types";
import type { CloseOutBlockingReason } from "@/lib/course-close-out/blocking-rules";

const initialState: FormState = { error: null };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CloseOutCard({
  courseId,
  cambridgeGradesConfirmedAt,
  blockingReasons,
  closeOut,
}: {
  courseId: string;
  cambridgeGradesConfirmedAt: string | null;
  blockingReasons: CloseOutBlockingReason[];
  closeOut: {
    status: CourseCloseOutStatus;
    verification_report: CloseOutVerificationReport | null;
    drive_folder_url: string | null;
    export_error: string | null;
    receipt_signed_name: string | null;
    receipt_signed_at: string | null;
    grace_period_ends_at: string | null;
    wiped_at: string | null;
  } | null;
}) {
  const [verifyState, verifyAction, verifyPending] = useActionState(initiateCloseOut, initialState);
  const [exportState, exportAction, exportPending] = useActionState(exportCloseOut, initialState);
  const [receiptState, receiptAction, receiptPending] = useActionState(confirmCloseOutReceipt, initialState);
  const [extendState, extendAction, extendPending] = useActionState(extendGracePeriod, initialState);

  const status = closeOut?.status ?? "not_started";

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Close-out</h2>
        <p className="mt-1 text-sm text-muted">
          Exports every candidate&apos;s complete record to your centre&apos;s Drive, then clears the working
          copy from Connect a week after your centre confirms receipt. The Drive export becomes the
          sole record afterward.
        </p>
      </div>

      <form action={toggleCambridgeGradesConfirmed} className="flex items-center justify-between gap-4 rounded-[6px] border border-border p-3">
        <div>
          <p className="text-sm text-ink">Cambridge has confirmed final grades</p>
          <p className="text-xs text-muted">The centre&apos;s own judgement -- never computed by the app.</p>
        </div>
        <input type="hidden" name="course_id" value={courseId} />
        <button
          type="submit"
          className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold ${
            cambridgeGradesConfirmedAt ? "bg-primary text-card" : "border border-border text-ink"
          }`}
        >
          {cambridgeGradesConfirmedAt ? `Confirmed ${formatDateTime(cambridgeGradesConfirmedAt)}` : "Mark confirmed"}
        </button>
      </form>

      {status === "wiped" ? (
        <p className="text-sm text-muted">
          This course was closed out{closeOut?.wiped_at ? ` on ${formatDateTime(closeOut.wiped_at)}` : ""}. Its record now lives
          entirely on your centre&apos;s Drive.
        </p>
      ) : status === "grace_period" ? (
        <div className="rounded-[6px] border border-status-warning-text/30 bg-status-warning-bg p-3">
          <p className="text-sm text-ink">
            Receipt signed by {closeOut?.receipt_signed_name} on{" "}
            {closeOut?.receipt_signed_at ? formatDateTime(closeOut.receipt_signed_at) : ""}.
          </p>
          <p className="mt-1 text-xs text-muted">
            The working copy clears automatically on{" "}
            {closeOut?.grace_period_ends_at ? formatDateTime(closeOut.grace_period_ends_at) : "--"}.
          </p>
          <form action={extendAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="course_id" value={courseId} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new_deletion_date" className="text-xs text-muted">
                Still in dispute? Push out the deletion date
              </label>
              <input
                id="new_deletion_date"
                name="new_deletion_date"
                type="date"
                required
                min={closeOut?.grace_period_ends_at ? closeOut.grace_period_ends_at.slice(0, 10) : undefined}
                className="rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={extendPending}
              className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
            >
              {extendPending ? "Saving..." : "Extend deletion date"}
            </button>
          </form>
          {extendState.error ? <p className="mt-1 text-sm text-destructive">{extendState.error}</p> : null}
        </div>
      ) : status === "awaiting_receipt" ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-[6px] border border-border p-3">
            <p className="text-sm text-ink">Exported to Drive.</p>
            {closeOut?.drive_folder_url ? (
              <a href={closeOut.drive_folder_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                Open the folder
              </a>
            ) : null}
          </div>
          {blockingReasons.length > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-[6px] border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-ink">Confirming receipt is held until this clears:</p>
              {blockingReasons.map((r) => (
                <p key={r.code} className="text-sm text-ink">
                  {r.message}
                </p>
              ))}
            </div>
          ) : (
            <form action={receiptAction} className="flex flex-wrap items-end gap-3 rounded-[6px] border border-border p-3">
              <input type="hidden" name="course_id" value={courseId} />
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="signed_name" className="text-xs text-muted">
                  Confirm receipt -- type your name
                </label>
                <input
                  id="signed_name"
                  name="signed_name"
                  type="text"
                  required
                  className="rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
              <button
                type="submit"
                disabled={receiptPending}
                className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
              >
                {receiptPending ? "Confirming..." : "Confirm receipt"}
              </button>
            </form>
          )}
          {receiptState.error ? <p className="text-sm text-destructive">{receiptState.error}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* build-spec.md: "Hold the erasure, not the export" -- these
              reasons only block confirming receipt (see the awaiting_receipt
              branch above), never verification or export, so this banner is
              informational here, not a gate. */}
          {blockingReasons.length > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-[6px] border border-status-warning-text/30 bg-status-warning-bg p-3">
              <p className="text-sm font-medium text-ink">
                Export is fine to run now, but the final clear-out will wait on:
              </p>
              {blockingReasons.map((r) => (
                <p key={r.code} className="text-sm text-ink">
                  {r.message}
                </p>
              ))}
            </div>
          ) : null}

          {status === "verify_failed" && closeOut?.verification_report ? (
            <div className="flex flex-col gap-1.5 rounded-[6px] border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-ink">
                {closeOut.verification_report.issues.length} issue{closeOut.verification_report.issues.length === 1 ? "" : "s"} found
                across {closeOut.verification_report.candidateCount} candidate
                {closeOut.verification_report.candidateCount === 1 ? "" : "s"}:
              </p>
              <ul className="flex flex-col gap-1">
                {closeOut.verification_report.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-ink">
                    <span className="font-semibold">{issue.traineeName}</span> -- {issue.artifact}: {issue.problem}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status === "export_failed" && closeOut?.export_error ? (
            <p className="text-sm text-destructive">{closeOut.export_error}</p>
          ) : null}

          {status === "ready_to_export" ? (
            <form action={exportAction}>
              <input type="hidden" name="course_id" value={courseId} />
              <button
                type="submit"
                disabled={exportPending}
                className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
              >
                {exportPending ? "Exporting... (this can take a while)" : "Export to Drive"}
              </button>
            </form>
          ) : (
            <form action={verifyAction}>
              <input type="hidden" name="course_id" value={courseId} />
              <button
                type="submit"
                disabled={verifyPending}
                className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
              >
                {verifyPending ? "Checking..." : status === "verify_failed" ? "Re-check" : "Run verification"}
              </button>
            </form>
          )}
          {exportState.error ? <p className="text-sm text-destructive">{exportState.error}</p> : null}
          {verifyState.error ? <p className="text-sm text-destructive">{verifyState.error}</p> : null}
        </div>
      )}
    </div>
  );
}
