"use client";

import { useActionState, useState } from "react";
import { submitVolunteerSignupProfile, type VolunteerSignupState } from "@/lib/fol/volunteer-signup-actions";
import { SIGNUP_LANGUAGES, SIGNUP_TRANSLATIONS } from "@/lib/fol/volunteer-signup-i18n";
import { RECORDING_PROMPTS } from "@/lib/fol/volunteer-signup-questions";
import { VolunteerRecorder } from "@/app/student/[token]/volunteer-recorder";

const initialState: VolunteerSignupState = { error: null };

const inputClass =
  "rounded-lg border border-[#eddfc4] bg-white px-3 py-2 text-sm text-[#3a2e18] outline-none focus:border-[#1a5c5e]";

type Step = "language" | "consent" | "questions" | "recording";
const STEPS: Step[] = ["language", "consent", "questions", "recording"];

// Volunteer Sign-Up.dc.html's real four-step flow (a fifth, "done", screen
// is handled by the ongoing dashboard StudentPage already shows once
// signup_completed_at is set -- no separate transient screen needed for
// that). One page, one client component, matching the design doc's own
// "same five screens... if the phone flow changes, this changes with it"
// note: a single responsive layout rather than separate mobile/desktop
// builds, the mockup's phone-frame and browser-chrome are presentational
// devices for the design doc itself, not two products to build.
export function VolunteerSignupForm({ token, questions }: { token: string; questions: string[] }) {
  const [state, action, pending] = useActionState(submitVolunteerSignupProfile, initialState);
  const [stepIndex, setStepIndex] = useState(0);
  const [lang, setLang] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  // Lifted out of the questions step's own textareas -- each step's fields
  // unmount when you navigate away from it (see the goBack() comment
  // below), so formData.get(`answer_${i}`) at final submit time would see
  // nothing for these unless they're mirrored into always-mounted hidden
  // inputs below.
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [recorderStatus, setRecorderStatus] = useState<"idle" | "requesting" | "recording" | "reviewing" | "error">("idle");

  const step = STEPS[stepIndex];
  const t = lang ? SIGNUP_TRANSLATIONS[lang] : null;

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  // Ramy, 25 Aug 2026: "I still can't go back... once I click on something,
  // I can't go back." Every step only ever moved forward -- no way to fix a
  // wrong language pick or re-read a question without abandoning the form
  // and starting over on a fresh token visit.
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="l1_language" value={lang ?? ""} />
      <input type="hidden" name="consent_given" value={consented ? "true" : ""} />
      {questions.map((_, i) => (
        <input key={i} type="hidden" name={`answer_${i}`} value={answers[i] ?? ""} />
      ))}

      {/* Ramy, 25 Aug 2026: "I still can't go back... once I click on
          something, I can't go back," then, once it was a bordered button
          sitting in the middle of each step's content, "why is it so in
          your face?" One consistent spot now -- top-left, above the
          progress bar, the conventional place a back control lives in any
          step wizard -- rather than repeated inline in each step's body. */}
      <div className="flex h-5 items-center">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm font-medium text-[#8a6a2f] hover:text-[#3a2e18]"
          >
            ← Back
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-[#1a5c5e]" : "bg-[#eddfc4]"}`}
          />
        ))}
      </div>

      {step === "language" ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-xl text-[#3a2e18]">Welcome</h2>
            <p className="mt-1 text-sm text-[#8a6a2f]">Which language would you like to read in?</p>
          </div>
          <div className="flex flex-col gap-2">
            {SIGNUP_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${
                  lang === l.code ? "border-[#1a5c5e] bg-[#fbf3e3]" : "border-[#eddfc4] bg-white"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-[#3a2e18]">{l.native}</p>
                  <p className="text-xs text-[#8a6a2f]">{l.english}</p>
                </div>
                {lang === l.code ? <span className="text-[#1a5c5e]">✓</span> : null}
              </button>
            ))}
          </div>
          {t ? <p className="text-xs text-[#8a6a2f]">{t.languageSub}</p> : null}
          <button
            type="button"
            onClick={goNext}
            disabled={!lang}
            className="self-start rounded-lg bg-[#1a5c5e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t?.continueLabel ?? "Continue"}
          </button>
        </div>
      ) : null}

      {step === "consent" && t ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-xl text-[#3a2e18]">{t.consentHeading}</h2>
            <p className="mt-1 text-sm text-[#8a6a2f]">{t.consentIntro}</p>
          </div>
          <div className="flex flex-col gap-2.5">
            {t.consentLines.map((line, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[#eddfc4] bg-[#fbf3e3] p-3.5">
                <span className="mt-0.5 flex size-4 flex-none items-center justify-center rounded bg-[#1a5c5e] text-[10px] text-white">
                  ✓
                </span>
                <p className="text-sm leading-relaxed text-[#3a2e18]">{line}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setConsented(true);
              goNext();
            }}
            className="self-start rounded-lg bg-[#1a5c5e] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t.agreeLabel}
          </button>
        </div>
      ) : null}

      {step === "questions" ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-xl text-[#3a2e18]">About you</h2>
            <p className="mt-1 text-sm text-[#8a6a2f]">
              Six short questions. Answer in English -- anything you can manage is fine. Nothing here is marked.
            </p>
          </div>
          {questions.map((question, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <label htmlFor={`answer_${i}`} className="text-sm text-[#8a6a2f]">
                {question}
              </label>
              <textarea
                id={`answer_${i}`}
                rows={2}
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))}
                className={inputClass}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={goNext}
            className="self-start rounded-lg bg-[#1a5c5e] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Next
          </button>
        </div>
      ) : null}

      {step === "recording" ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-serif text-xl text-[#3a2e18]">Now just talk</h2>
            <p className="mt-1 text-sm text-[#8a6a2f]">
              Eight questions. Answer out loud in English. Stop when you want -- two to three minutes altogether.
            </p>
          </div>
          <VolunteerRecorder
            prompts={RECORDING_PROMPTS}
            recordingConsentLine={t?.recordingConsentLine ?? "I agree to being recorded for training purposes."}
            onStatusChange={setRecorderStatus}
          />
          {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
          {recorderStatus === "reviewing" ? (
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 self-start rounded-lg bg-[#3a2e18] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? (
                <>
                  {/* Ramy, 25 Aug 2026: "so they wouldn't just think it's
                      finished and then leave" -- a spinner, not just static
                      text, so a several-second save visibly reads as still
                      working rather than stuck. */}
                  <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving your answers…
                </>
              ) : (
                "Finish sign-up"
              )}
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
