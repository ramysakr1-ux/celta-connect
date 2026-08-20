"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/login/actions";
import { SignInLinkForm } from "@/app/login/sign-in-link-form";

const initialState: SignInState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm text-muted">
              Password
            </label>
            <a href="/forgot-password" className="text-xs text-muted hover:text-ink">
              Forgot?
            </a>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card hover:bg-ink-warm/90 disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <SignInLinkForm next={next} />
    </div>
  );
}
