"use client";

import { useActionState } from "react";
import { joinCourse, type JoinCourseState } from "@/app/join/[token]/actions";

const initialState: JoinCourseState = { error: null };

const inputClass =
  "rounded-[6px] border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-[#f5f5f0] outline-none focus:border-[#c99a4a]";

export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(joinCourse, initialState);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm text-[#9a9a92]">
          Full name
        </label>
        <input id="full_name" name="full_name" type="text" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-[#9a9a92]">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-[#9a9a92]">
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
        <label htmlFor="confirm_password" className="text-sm text-[#9a9a92]">
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

      <div className="mt-2 flex flex-col gap-3 border-t border-[#262626] pt-4">
        <label className="flex items-start gap-2 text-xs leading-relaxed text-[#9a9a92]">
          <input
            type="checkbox"
            name="agree_ip"
            required
            className="mt-0.5 accent-[#c99a4a]"
          />
          <span>
            I agree not to copy, reverse-engineer, or share access to the Connect CELTA platform,
            and to use it only for the purposes of my course.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-[#9a9a92]">
          <input
            type="checkbox"
            name="agree_data"
            required
            className="mt-0.5 accent-[#c99a4a]"
          />
          <span>
            I understand that my coursework, tutor feedback, and records are held in CELTA
            Connect during the course and archived to the centre&apos;s secure Google Drive
            afterwards.
          </span>
        </label>
      </div>

      {state.error ? <p className="text-sm text-[#e5a3a3]">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-[#c99a4a] px-4 py-2 font-medium text-[#0a0a0a] disabled:opacity-60"
      >
        {pending ? "Joining..." : "Join course"}
      </button>
    </form>
  );
}
