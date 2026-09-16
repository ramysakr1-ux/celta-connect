"use client";

import { useRef, useState } from "react";

export interface WizardStep {
  key: string;
  content: React.ReactNode;
  /** Extra classes on the step's own wrapper -- the grid item, when the wizard
   *  sits inside a grid. The self-evaluation uses it to span sections 5 and 6
   *  across both columns while questions 1-4 sit 2x2
   *  (design_handoff_tp_feedback_cycle §2b). */
  className?: string;
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
  const wrappers = useRef<(HTMLDivElement | null)[]>([]);

  // A `required` field left empty on a step that is now hidden would make
  // the browser refuse the final submit with nothing to show for it -- an
  // invalid control inside display:none is not focusable, so no message ever
  // appears. Each step is checked on its way out instead, while its fields
  // are on screen and can say what is missing (application form, 16 Sep
  // 2026). Desktop shows every step at once and keeps native validation.
  const next = () => {
    const wrapper = wrappers.current[clamped];
    const fields = wrapper ? Array.from(wrapper.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")) : [];
    const invalid = fields.find((f) => !f.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setCurrent((c) => Math.min(steps.length - 1, c + 1));
  };

  return (
    <>
      {steps.map((step, i) => (
        <div
          key={step.key}
          ref={(el) => {
            wrappers.current[i] = el;
          }}
          className={`${i === clamped ? "block" : "hidden md:block"} ${step.className ?? ""}`}
        >
          {step.content}
        </div>
      ))}
      {steps.length > 1 ? (
        <div className="col-span-full flex items-center justify-between gap-3 p-4 md:hidden">
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={clamped === 0}
            className="rounded-[6px] border border-border px-4 py-2 text-body font-medium text-ink disabled:opacity-40"
          >
            Back
          </button>
          <p className="text-label font-medium text-muted">
            {clamped + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={next}
            disabled={clamped === steps.length - 1}
            className="rounded-[6px] border border-primary px-4 py-2 text-body font-medium text-primary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}
