"use client";

import { useActionState } from "react";
import { addVolunteerStudent, type FormState } from "@/app/trainer/(hub)/volunteers/actions";
import { LEVEL_OPTIONS } from "@/lib/levels";

const initialState: FormState = { error: null };

export function AddVolunteerForm() {
  const [state, formAction, pending] = useActionState(addVolunteerStudent, initialState);

  return (
    <form action={formAction} className="sheet flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <label className="text-sm text-muted">Name</label>
        <input
          name="name"
          type="text"
          required
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Class level</label>
        <select
          name="level"
          defaultValue=""
          className="h-10 appearance-none rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="">Not set</option>
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add volunteer"}
      </button>
    </form>
  );
}
