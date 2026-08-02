"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/login/actions";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
          autoComplete="current-password"
          className="card rounded-[6px] px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-primary px-4 py-2 font-medium text-card disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>

      <a href="/forgot-password" className="text-center text-sm text-muted hover:text-ink">
        Forgot password?
      </a>
    </form>
  );
}
