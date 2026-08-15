"use client";

import { useActionState } from "react";
import { submitVolunteerSignupProfile, type VolunteerSignupState } from "@/lib/fol/volunteer-signup-actions";

const initialState: VolunteerSignupState = { error: null };

// Six questions + an audio recording, collected once before a volunteer
// ever sees their ongoing dashboard. On mobile, `capture` opens the native
// voice recorder directly; on desktop it falls back to a plain file
// picker -- no in-browser MediaRecorder UI, since the exact recording
// screen isn't designed yet (Volunteer Sign-Up.dc.html not built).
export function VolunteerSignupForm({ token, questions }: { token: string; questions: string[] }) {
  const [state, action, pending] = useActionState(submitVolunteerSignupProfile, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {questions.map((question, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <label htmlFor={`answer_${i}`} className="text-sm text-[#8a6a2f]">
            {question}
          </label>
          <textarea
            id={`answer_${i}`}
            name={`answer_${i}`}
            required
            rows={2}
            className="rounded-lg border border-[#eddfc4] bg-white px-3 py-2 text-sm text-[#3a2e18] outline-none focus:border-[#b3892f]"
          />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="audio" className="text-sm text-[#8a6a2f]">
          A short voice recording (optional) -- tell us a bit about yourself, in English
        </label>
        <input id="audio" name="audio" type="file" accept="audio/*" capture="user" className="text-sm text-[#3a2e18]" />
      </div>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-[#b3892f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : "Done"}
      </button>
    </form>
  );
}
