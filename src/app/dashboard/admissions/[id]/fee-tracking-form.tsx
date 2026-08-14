import { setFeePaid, recordWaiver } from "@/app/dashboard/admissions/actions";
import type { Database } from "@/lib/supabase/types";

type Applicant = Database["public"]["Tables"]["applicants"]["Row"];

const inputClass = "rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary";

// "Connect never holds money and never decides a refund" -- every figure
// here is "marked by" a named person, never "confirmed" by anything
// automated (no provider integration, confirmed with Ramy 2026-08-14).
export function FeeTrackingForm({ applicant }: { applicant: Applicant }) {
  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Fee</h2>
        <p className="text-sm text-muted">
          {applicant.fee_amount ? `${applicant.fee_amount} ${applicant.fee_currency ?? ""}` : "No fee recorded yet"}
        </p>
      </div>

      {applicant.fee_paid ? (
        <div className="rounded-[6px] border border-border p-3 text-sm text-ink">
          <p>Marked paid{applicant.fee_paid_at ? ` on ${applicant.fee_paid_at.slice(0, 10)}` : ""}.</p>
          {applicant.fee_paid_note ? <p className="mt-1 text-muted">{applicant.fee_paid_note}</p> : null}
          <form action={setFeePaid} className="mt-2">
            <input type="hidden" name="applicant_id" value={applicant.id} />
            <input type="hidden" name="paid" value="false" />
            <button type="submit" className="text-xs text-destructive hover:underline">
              Undo -- mark unpaid
            </button>
          </form>
        </div>
      ) : (
        <form action={setFeePaid} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="applicant_id" value={applicant.id} />
          <input type="hidden" name="paid" value="true" />
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="fee_paid_note" className="text-xs text-muted">
              Reference / instalment note (optional)
            </label>
            <input id="fee_paid_note" name="fee_paid_note" type="text" className={inputClass} />
          </div>
          <button type="submit" className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card">
            Mark paid
          </button>
        </form>
      )}

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-ink">Waiver / discount</h3>
        {applicant.waiver_note ? (
          <p className="mt-1 text-sm text-ink">
            {applicant.waiver_note} -- agreed by {applicant.waiver_agreed_role ?? "staff"}
          </p>
        ) : (
          <form action={recordWaiver} className="mt-2 flex flex-wrap items-end gap-3">
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
    </div>
  );
}
