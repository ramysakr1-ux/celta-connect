"use client";

import { useActionState } from "react";
import { requestReferralAction } from "@/app/dashboard/admissions/actions";
import type { ReferFormState } from "@/app/dashboard/admissions/actions";

const initialState: ReferFormState = { error: null };

export interface RequestReferralDestination {
  centerId: string;
  centerName: string;
}

// build-spec.md §14: "Where nobody spans the two, it becomes a request the
// receiving branch accepts." Shown instead of ReferForm when the viewer
// doesn't hold admissions at any sibling branch -- picks a BRANCH only, not
// an intake, since the requester has no visibility into the destination's
// own courses. Whoever accepts picks the intake.
export function RequestReferralForm({
  applicantId,
  destinations,
  garnet = false,
}: {
  applicantId: string;
  destinations: RequestReferralDestination[];
  garnet?: boolean;
}) {
  const [state, action, pending] = useActionState(requestReferralAction, initialState);

  if (destinations.length === 0) return null;

  return (
    <form action={action} className={`card flex flex-col gap-3 p-6 ${garnet ? "card-garnet" : ""}`}>
      <input type="hidden" name="applicant_id" value={applicantId} />
      <h2 className="font-serif text-lg text-ink">Request a referral to another branch</h2>
      <p className="text-xs text-muted">
        You don&apos;t hold admissions at these branches, so this sends a request instead of referring directly.
        Everything the candidate has done still moves with them once accepted -- nothing changes for them in the
        meantime.
      </p>
      <select
        name="to_center_id"
        required
        defaultValue=""
        className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary"
      >
        <option value="" disabled>
          Choose a branch
        </option>
        {destinations.map((d) => (
          <option key={d.centerId} value={d.centerId}>
            {d.centerName}
          </option>
        ))}
      </select>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-4 py-2 text-sm font-semibold text-ink hover:border-primary disabled:opacity-60 admin-hover-fill"
      >
        {pending ? "Sending..." : "Send referral request"}
      </button>
    </form>
  );
}
