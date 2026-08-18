"use client";

import { useActionState } from "react";
import Link from "next/link";
import { joinCentre, type JoinCentreState } from "@/app/join-centre/[token]/actions";

const initialState: JoinCentreState = { error: null };

const inputClass =
  "h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary";

export function JoinCentreForm({ token, roleLabel }: { token: string; roleLabel: string }) {
  const [state, action, pending] = useActionState(joinCentre, initialState);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm text-muted">
          Full name
        </label>
        <input id="full_name" name="full_name" type="text" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-muted">
          Choose a password
        </label>
        <input id="password" name="password" type="password" required autoComplete="new-password" className={inputClass} />
        <p className="text-xs text-muted">At least 8 characters.</p>
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
          className={inputClass}
        />
      </div>

      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">
          By checking the boxes below you agree to our{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            full terms
          </Link>
          .
        </p>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_data" required className="mt-0.5 accent-primary" />
          <span>
            The centre is responsible for the candidate and applicant data it holds here, and for what its staff do
            with it.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_ip" required className="mt-0.5 accent-primary" />
          <span>The centre will not copy, reproduce or reverse-engineer the platform, its templates or its structure.</span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_export" required className="mt-0.5 accent-primary" />
          <span>
            I understand that when a course closes its record is exported to our Drive and then removed from here,
            and that the centre keeps its own retained copies.
          </span>
        </label>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card hover:bg-ink-warm/90 disabled:opacity-60"
      >
        {pending ? "Setting up..." : `Create my account and accept`}
      </button>
      <p className="text-center text-xs text-muted">Signing up as {roleLabel.toLowerCase()}.</p>
    </form>
  );
}
