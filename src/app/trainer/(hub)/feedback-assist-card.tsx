"use client";

import { useActionState, useState, useTransition } from "react";
import {
  saveFeedbackAssistAction,
  toggleFeedbackAssistEnabledAction,
  type FeedbackAssistFormState,
} from "@/app/trainer/(hub)/feedback-assist-actions";

const initialState: FeedbackAssistFormState = { error: null };

// Trainer Homepage.dc.html's "Feedback assist" card. Direct examples in
// primary/teal (matches the design's Direct color exactly); Encouraging has
// no existing app-wide token, so its oklch is inline per the design's own
// tokens list rather than inventing a new global one for a single card.
//
// Re-pointed 2026-08-21 per the color audit: the original green collided
// with "positive/primary" meaning reserved for teal. Kept in the teal
// family (same hue as --color-primary, 195) but lighter and less saturated
// than Direct's dark teal, so the two tone examples stay visually distinct
// rather than reading as identical.
const ENCOURAGING_INK = "oklch(58% 0.1 195)";

export function FeedbackAssistCard({
  initialEnabled,
  initialDirect,
  initialSupportive,
}: {
  initialEnabled: boolean;
  initialDirect: string[];
  initialSupportive: string[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [editing, setEditing] = useState(false);
  const [direct, setDirect] = useState(initialDirect);
  const [supportive, setSupportive] = useState(initialSupportive);
  const [isTogglePending, startToggleTransition] = useTransition();
  const [state, formAction, savePending] = useActionState<FeedbackAssistFormState, FormData>(
    async (_prev, formData) => {
      const result = await saveFeedbackAssistAction(_prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    initialState
  );

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    startToggleTransition(async () => {
      const result = await toggleFeedbackAssistEnabledAction(next);
      if (result.error) setEnabled(!next);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-[8px] border border-border border-t-[3px] border-t-gold bg-card px-[22px] py-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Feedback assist — yours</p>
          <p className="text-xs leading-[1.5] text-muted text-pretty">
            Starts from the course default the MCT set, then it&apos;s yours — edit it or turn it off, on your own
            feedback only.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            title="Use feedback assist"
            onClick={toggleEnabled}
            disabled={isTogglePending}
            className="relative h-5 w-[34px] shrink-0 rounded-full transition-colors disabled:opacity-60"
            style={{ background: enabled ? "var(--color-primary)" : "oklch(85% 0.012 82)" }}
          >
            <span
              className="absolute top-0.5 size-4 rounded-full bg-card transition-[left]"
              style={{ left: enabled ? "16px" : "2px" }}
            />
          </button>
          {enabled ? (
            <button
              type="button"
              onClick={() => {
                if (editing) {
                  setDirect(initialDirect);
                  setSupportive(initialSupportive);
                }
                setEditing((v) => !v);
              }}
              className="h-8 rounded-[6px] border border-border bg-card px-3.5 text-[12.5px] font-medium text-ink"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {enabled ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-ink">Tone examples</p>
          <p className="text-xs leading-[1.5] text-muted">
            Shown when you click the tone icon while writing feedback — rewrites the sentence direct or encouraging.
          </p>

          {editing ? (
            <form action={formAction} className="mt-1 flex flex-col gap-1.5">
              {direct.map((text, i) => (
                <ExampleRow key={`direct-${i}`} label="Direct" ink="var(--color-primary)" name="direct" value={text} onChange={(v) => setDirect((prev) => prev.map((t, x) => (x === i ? v : t)))} />
              ))}
              {supportive.map((text, i) => (
                <ExampleRow key={`supportive-${i}`} label="Encouraging" ink={ENCOURAGING_INK} name="supportive" value={text} onChange={(v) => setSupportive((prev) => prev.map((t, x) => (x === i ? v : t)))} />
              ))}
              {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
              <div className="mt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={savePending}
                  className="h-[30px] rounded-[6px] bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {savePending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-1 flex flex-col gap-1.5">
              {direct.map((text, i) => (
                <DisplayRow key={`direct-${i}`} label="Direct" ink="var(--color-primary)" text={text} />
              ))}
              {supportive.map((text, i) => (
                <DisplayRow key={`supportive-${i}`} label="Encouraging" ink={ENCOURAGING_INK} text={text} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted">Off — the tone icon won&apos;t appear on your feedback forms.</p>
      )}
    </div>
  );
}

function ExampleRow({
  label,
  ink,
  name,
  value,
  onChange,
}: {
  label: string;
  ink: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-[78px] shrink-0 pt-2 text-[10.5px] font-bold tracking-[0.06em] uppercase" style={{ color: ink }}>
        {label}
      </span>
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="min-h-[34px] flex-1 rounded-[6px] border border-border bg-card px-2.5 py-[7px] text-[12.5px] leading-[1.4] text-ink outline-none focus:border-primary"
      />
    </div>
  );
}

function DisplayRow({ label, ink, text }: { label: string; ink: string; text: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[12.5px] leading-[1.5]">
      <span className="w-[78px] shrink-0 text-[10.5px] font-bold tracking-[0.06em] uppercase" style={{ color: ink }}>
        {label}
      </span>
      <span className="text-ink">{text || <span className="text-muted italic">Not set yet</span>}</span>
    </div>
  );
}
