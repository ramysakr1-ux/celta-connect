"use client";

import { useActionState } from "react";
import { referApplicantAction, type ReferFormState } from "@/app/dashboard/admissions/actions";

const initialState: ReferFormState = { error: null };

export interface ReferDestination {
  centerId: string;
  centerName: string;
  courseId: string;
  courseName: string;
}

// build-spec.md §14: "Everything the candidate has done moves with them...
// they arrive at Interviewed, not back at Enquiry." Only offered when the
// viewer already holds admissions at the destination branch too -- the
// single-action case; a destination the viewer doesn't hold access to
// simply never appears in this list, per-referApplicantAction's own
// server-side re-check.
export function ReferForm({ applicantId, destinations }: { applicantId: string; destinations: ReferDestination[] }) {
  const [state, action, pending] = useActionState(referApplicantAction, initialState);

  if (destinations.length === 0) return null;

  return (
    <form action={action} className="card flex flex-col gap-3 p-6">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <h2 className="font-serif text-lg text-ink">Refer to another branch</h2>
      <p className="text-xs text-muted">
        Everything they&apos;ve done moves with them -- application, marked task, interview notes, and their place
        in the pipeline. This record stays here, marked referred out. A paid deposit stays at this branch.
      </p>
      <select
        name="destination"
        required
        defaultValue=""
        className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink outline-none focus:border-primary"
      >
        <option value="" disabled>
          Choose a branch and intake
        </option>
        {destinations.map((d) => (
          <option key={`${d.centerId}::${d.courseId}`} value={`${d.centerId}::${d.courseId}`}>
            {d.centerName} -- {d.courseName}
          </option>
        ))}
      </select>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-4 py-2 text-sm font-semibold text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Referring..." : "Refer this candidate"}
      </button>
    </form>
  );
}
