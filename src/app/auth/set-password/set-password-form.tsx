"use client";

import { useActionState } from "react";
import { setPassword, type SetPasswordState } from "@/app/auth/set-password/actions";

const initialState: SetPasswordState = { error: null };

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, initialState);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-muted">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="card rounded-[6px] px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm_password" className="text-sm text-muted">
          Confirm password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          autoComplete="new-password"
          className="card rounded-[6px] px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-primary px-4 py-2 font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Set password"}
      </button>
    </form>
  );
}
