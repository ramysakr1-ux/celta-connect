"use client";

import { useActionState } from "react";
import { updateCoursePricing, type FormState } from "@/app/centre/courses/[id]/actions";

const initialState: FormState = { error: null };
const field = "h-10 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary";

export function PricingForm({
  courseId,
  feeAmount,
  depositAmount,
  feeCurrency,
  depositDueDays,
}: {
  courseId: string;
  feeAmount: number | null;
  depositAmount: number | null;
  feeCurrency: string | null;
  depositDueDays: number | null;
}) {
  const [state, action, pending] = useActionState(updateCoursePricing, initialState);

  return (
    <form action={action} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="course_id" value={courseId} />
      <div>
        <h2 className="font-serif text-base text-ink">Pricing</h2>
        <p className="mt-1 text-xs text-muted">The fee and deposit print on the offer email; the deposit-due window is what the acceptance email promises.</p>
      </div>

      <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="fee_amount" className="text-[13px] font-semibold text-ink">
            Fee
          </label>
          <input id="fee_amount" name="fee_amount" type="number" min="0" step="0.01" defaultValue={feeAmount ?? ""} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="deposit_amount" className="text-[13px] font-semibold text-ink">
            Deposit
          </label>
          <input id="deposit_amount" name="deposit_amount" type="number" min="0" step="0.01" defaultValue={depositAmount ?? ""} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="fee_currency" className="text-[13px] font-semibold text-ink">
            Currency
          </label>
          <input id="fee_currency" name="fee_currency" type="text" maxLength={3} defaultValue={feeCurrency ?? ""} className={`${field} uppercase`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="deposit_due_days" className="text-[13px] font-semibold text-ink">
            Deposit due (days)
          </label>
          <input id="deposit_due_days" name="deposit_due_days" type="number" min="1" defaultValue={depositDueDays ?? ""} className={field} />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
