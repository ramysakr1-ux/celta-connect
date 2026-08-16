"use client";

import { useActionState, useState } from "react";
import { createCourse, type FormState } from "@/app/dashboard/admin/actions";
import { DeliveryModePicker } from "@/components/delivery-mode-picker";
import type { DeliveryMode } from "@/lib/delivery-mode";

const initialState: FormState = { error: null };

export function CreateCourseForm({ centerNumber }: { centerNumber?: string | null }) {
  const [state, action, pending] = useActionState(createCourse, initialState);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("f2f");

  return (
    <form action={action} className="card mt-4 flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">New course</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm text-muted">
          Course name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. September 2026 CELTA"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="start_date" className="text-sm text-muted">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="end_date" className="text-sm text-muted">
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* The step card, matched to Course Admin.dc.html 2a: an 11px uppercase
          eyebrow at 0.1em, a Newsreader 22px question, then the explanatory
          line at 12.5px/1.6 muted. The eyebrow carries the real centre code
          and course name rather than the design's sample. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">
          New course{centerNumber ? ` · ${centerNumber}` : ""} · step 2 of 6
        </p>
        <h3 className="font-serif text-[22px] font-semibold text-ink">How is teaching practice delivered?</h3>
        <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-muted">
          The mode is defined by where teaching practice happens, not where input happens. A course can deliver
          input online and still be face-to-face.
        </p>
        <input type="hidden" name="delivery_mode" value={deliveryMode} />
        <DeliveryModePicker value={deliveryMode} onChange={setDeliveryMode} />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create course"}
      </button>
    </form>
  );
}
