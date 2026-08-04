"use client";

import { useActionState } from "react";
import { addVolunteerStudentViaRegister, type FormState } from "@/app/register/[token]/actions";

const initialState: FormState = { error: null };

export function AddVolunteerForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(addVolunteerStudentViaRegister, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-1 flex-col gap-1.5">
        <label className="text-sm text-muted">Name</label>
        <input
          name="name"
          type="text"
          required
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add student"}
      </button>
    </form>
  );
}
