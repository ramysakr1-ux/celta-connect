import { recordWaiver } from "@/app/dashboard/admissions/actions";
import type { Database } from "@/lib/supabase/types";

type Applicant = Database["public"]["Tables"]["applicants"]["Row"];

const inputClass = "rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary";

// Split out of the old FeeTrackingForm when that was replaced by
// PaymentsPanel -- a waiver/discount is a separate concept from payment
// tracking (it changes what's owed, not how it's paid) and isn't part of
// the payments-bridge spec.
export function WaiverForm({ applicant }: { applicant: Applicant }) {
  return (
    <div className="card flex flex-col gap-3 p-6">
      <h2 className="font-serif text-lg text-ink">Waiver / discount</h2>
      {applicant.waiver_note ? (
        <p className="text-sm text-ink">
          {applicant.waiver_note} -- agreed by {applicant.waiver_agreed_role ?? "staff"}
        </p>
      ) : (
        <form action={recordWaiver} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="applicant_id" value={applicant.id} />
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="waiver_note" className="text-xs text-muted">
              What was agreed
            </label>
            <input id="waiver_note" name="waiver_note" type="text" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="waiver_agreed_role" className="text-xs text-muted">
              Your role in agreeing it
            </label>
            <input id="waiver_agreed_role" name="waiver_agreed_role" type="text" placeholder="e.g. Centre Director" className={inputClass} />
          </div>
          <button type="submit" className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink hover:border-primary">
            Record
          </button>
        </form>
      )}
    </div>
  );
}
