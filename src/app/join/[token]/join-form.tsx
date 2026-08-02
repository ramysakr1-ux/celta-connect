"use client";

import { useActionState } from "react";
import { joinCourse, type JoinCourseState } from "@/app/join/[token]/actions";

const initialState: JoinCourseState = { error: null };

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(joinCourse, initialState);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm text-muted">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          className="card rounded-[6px] px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="card rounded-[6px] px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-muted">
          Password
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
        {pending ? "Joining..." : "Join course"}
      </button>
    </form>
  );
}
