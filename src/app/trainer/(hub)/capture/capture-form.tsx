"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { captureTeachingPoint, type CaptureFormState } from "@/app/trainer/(hub)/capture/actions";
import { VoiceTextarea } from "@/components/voice-textarea";

const initialState: CaptureFormState = { error: null, savedAt: null };

export function CaptureForm({
  roster,
  tpNumbers,
}: {
  roster: { id: string; full_name: string }[];
  tpNumbers: number[];
}) {
  const [state, formAction, pending] = useActionState(captureTeachingPoint, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Clears the text field (but keeps candidate/TP selected -- capturing
  // several points in a row for the same trainee mid-lesson is the whole
  // point) after a successful save, and shows a brief confirmation.
  useEffect(() => {
    if (state.savedAt) {
      const textarea = formRef.current?.querySelector<HTMLTextAreaElement>("textarea[name='text']");
      if (textarea) textarea.value = "";
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [state.savedAt]);

  return (
    <form ref={formRef} action={formAction} className="sheet flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Who</span>
          <select
            name="trainee_id"
            required
            className="h-11 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Choose...</option>
            {roster.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Which TP</span>
          <select
            name="tp_number"
            required
            className="h-11 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Choose...</option>
            {tpNumbers.map((n) => (
              <option key={n} value={n}>
                TP{n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <VoiceTextarea
        name="text"
        rows={4}
        placeholder="Type or tap Dictate -- a strength, an action point, anything to remember for the feedback form later."
        className="w-full rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {justSaved ? <p className="text-sm text-primary">Captured.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Capturing…" : "Capture point"}
      </button>
    </form>
  );
}
