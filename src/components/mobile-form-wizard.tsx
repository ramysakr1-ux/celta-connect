"use client";

import { useState } from "react";

export interface WizardStep {
  key: string;
  content: React.ReactNode;
}

// specs/build-spec.md §7: "Trainee -- everything, one question per screen,
// dictation on the question itself." A single render tree, not a
// desktop-tree/mobile-tree duplicate -- duplicating would double up every
// input's `name` attribute in the same <form>, which silently corrupts
// FormData on submit (only one of the two same-named values survives).
// Instead each step's wrapper is hidden/shown by CSS alone: `hidden` (or
// `block` when it's the current step) below `md`, forced back to `block`
// at `md:` and up regardless of which step is "current" -- Tailwind's
// breakpoint utilities win over the unprefixed base class at that
// breakpoint, so desktop always shows every step exactly as it did before
// this component existed, no JS branching needed for that half.
export function MobileFormWizard({ steps }: { steps: WizardStep[] }) {
  const [current, setCurrent] = useState(0);
  const clamped = Math.min(current, steps.length - 1);

  return (
    <>
      {steps.map((step, i) => (
        <div key={step.key} className={i === clamped ? "block" : "hidden md:block"}>
          {step.content}
        </div>
      ))}
      {steps.length > 1 ? (
        <div className="flex items-center justify-between gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={clamped === 0}
            className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
          >
            Back
          </button>
          <p className="text-xs font-medium text-muted">
            {clamped + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.min(steps.length - 1, c + 1))}
            disabled={clamped === steps.length - 1}
            className="rounded-[6px] border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}
