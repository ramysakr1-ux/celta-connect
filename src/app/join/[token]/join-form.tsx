"use client";

import { useActionState } from "react";
import { joinCourse, type JoinCourseState } from "@/app/join/[token]/actions";

const initialState: JoinCourseState = { error: null };

const inputClass =
  "h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(joinCourse, initialState);

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
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
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
          className={inputClass}
        />
      </div>

      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_ip" required className="mt-0.5 accent-primary" />
          <span>
            I agree not to copy, reverse-engineer, or share access to the Connect CELTA platform,
            and to use it only for the purposes of my course.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_data" required className="mt-0.5 accent-primary" />
          <span>
            I understand that my coursework, tutor feedback, and records are held in CELTA
            Connect during the course and archived to the centre&apos;s secure Google Drive
            afterwards.
          </span>
        </label>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Joining..." : "Join course"}
      </button>
    </form>
  );
}
