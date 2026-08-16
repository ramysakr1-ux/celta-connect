"use client";

import { useActionState, useState } from "react";
import { createCourse, type FormState } from "@/app/dashboard/admin/actions";
import { DeliveryModePicker } from "@/components/delivery-mode-picker";
import type { DeliveryMode } from "@/lib/delivery-mode";

const initialState: FormState = { error: null };

const field =
  "h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary";

/**
 * The new-course wizard, steps 1 and 2 of 6 (Course Admin.dc.html).
 *
 * Two steps rather than one screen, because the design separates them and the
 * separation carries meaning: step 1 is what the course IS and prints on
 * Cambridge documents, step 2 is a decision that rewrites the timetable if
 * changed later. "Continue to delivery mode" is the design's own button label.
 *
 * Both steps live in one <form>: the fields from step 1 stay mounted while
 * step 2 shows, so going back never loses what was typed and the whole thing
 * submits once.
 */
export function CreateCourseForm({ centerNumber }: { centerNumber?: string | null }) {
  const [state, action, pending] = useActionState(createCourse, initialState);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("f2f");
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <form action={action} className="card mt-4 flex flex-col gap-4 p-6">
      {/* Step 1 — course details */}
      <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
            New course · step 1 of 6
          </p>
          <h3 className="font-serif text-[22px] font-semibold text-ink">Course details</h3>
          <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
            The centre number and course code print on every certificate and report — get them right here.
          </p>
        </div>

        {/* "Prefilled from the centre profile and locked here — change it in
            Centre Admin, not per course." Rendered as text, not a disabled
            input: a greyed-out box invites people to try to type in it. */}
        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-ink">Cambridge centre number</label>
          <p className="text-sm text-ink">{centerNumber ?? "Not set"}</p>
          <p className="text-xs text-muted">
            Prefilled from the centre profile and locked here — change it in Centre Admin, not per course.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="course_code" className="text-[13px] font-semibold text-ink">
            Course code
          </label>
          <input id="course_code" name="course_code" type="text" placeholder="C3/2024" className={field} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-[13px] font-semibold text-ink">
            Course name (internal, candidates don&apos;t see this)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="January intensive 2024"
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-[14px]">
          <div className="flex flex-col gap-1">
            <label htmlFor="start_date" className="text-[13px] font-semibold text-ink">
              Start date
            </label>
            <input id="start_date" name="start_date" type="date" required className={field} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="end_date" className="text-[13px] font-semibold text-ink">
              End date
            </label>
            <input id="end_date" name="end_date" type="date" required className={field} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cohort_size" className="text-[13px] font-semibold text-ink">
            Maximum cohort size
          </label>
          <input
            id="cohort_size"
            name="cohort_size"
            type="number"
            min="1"
            placeholder="12 candidates"
            className={`${field} w-40`}
          />
        </div>

        <button
          type="button"
          onClick={() => setStep(2)}
          className="self-start rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card"
        >
          Continue to delivery mode
        </button>
      </div>

      {/* Step 2 — delivery mode */}
      <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
            New course{centerNumber ? ` · ${centerNumber}` : ""} · step 2 of 6
          </p>
          <h3 className="font-serif text-[22px] font-semibold text-ink">How is teaching practice delivered?</h3>
          <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
            The mode is defined by where teaching practice happens, not where input happens. A course can deliver
            input online and still be face-to-face.
          </p>
        </div>

        <input type="hidden" name="delivery_mode" value={deliveryMode} />
        <DeliveryModePicker value={deliveryMode} onChange={setDeliveryMode} />

        {/* The design says this plainly at setup, because the obvious next
            question after choosing a mode is "where do I add my tutors?" */}
        <p className="rounded-[6px] border border-border bg-surface-muted px-3 py-2 text-xs text-muted">
          Tutors are assigned on the roster, not in this wizard.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create course"}
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-sm text-muted underline">
            Back to course details
          </button>
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
