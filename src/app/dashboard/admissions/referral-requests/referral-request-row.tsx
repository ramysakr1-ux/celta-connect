"use client";

import { useActionState, useState } from "react";
import {
  acceptReferralRequestAction,
  declineReferralRequestAction,
  type ReferralDecisionState,
} from "@/app/dashboard/admissions/actions";

const initialState: ReferralDecisionState = { error: null };

export function ReferralRequestRow({
  request,
  courses,
}: {
  request: {
    id: string;
    toCenterId: string;
    applicantName: string;
    applicantEmail: string;
    fromCenterName: string;
    requestedAt: string;
  };
  courses: { id: string; name: string }[];
}) {
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptReferralRequestAction, initialState);
  const [declineState, declineAction, declinePending] = useActionState(declineReferralRequestAction, initialState);
  const [declining, setDeclining] = useState(false);

  return (
    <div className="card flex flex-col gap-3 p-6 admin-hover">
      <div>
        <p className="text-sm font-semibold text-ink">{request.applicantName}</p>
        <p className="text-xs text-muted">{request.applicantEmail}</p>
        <p className="mt-1 text-xs text-muted">
          Requested by {request.fromCenterName} · {new Date(request.requestedAt).toLocaleString("en-GB")}
        </p>
      </div>

      {!declining ? (
        <div className="flex flex-wrap items-center gap-3">
          <form action={acceptAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="to_center_id" value={request.toCenterId} />
            <select
              name="to_course_id"
              required
              defaultValue=""
              className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="" disabled>
                Place into which intake
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={acceptPending || courses.length === 0}
              className="rounded-[6px] border border-primary bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {acceptPending ? "Accepting..." : "Accept"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="rounded-[6px] border border-border px-3 py-2 text-sm font-medium text-ink hover:border-destructive admin-hover-fill"
          >
            Decline
          </button>
        </div>
      ) : (
        <form action={declineAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="to_center_id" value={request.toCenterId} />
          <input
            type="text"
            name="reason"
            placeholder="Reason (optional)"
            className="h-9 flex-1 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={declinePending}
            className="rounded-[6px] border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60 admin-hover-fill"
          >
            {declinePending ? "Declining..." : "Confirm decline"}
          </button>
          <button
            type="button"
            onClick={() => setDeclining(false)}
            className="rounded-[6px] border border-border px-3 py-2 text-sm text-muted hover:text-ink admin-hover-fill"
          >
            Cancel
          </button>
        </form>
      )}

      {courses.length === 0 ? (
        <p className="text-xs text-destructive">This branch has no intakes to place them into yet.</p>
      ) : null}
      {acceptState.error ? <p className="text-sm text-destructive">{acceptState.error}</p> : null}
      {declineState.error ? <p className="text-sm text-destructive">{declineState.error}</p> : null}
    </div>
  );
}
