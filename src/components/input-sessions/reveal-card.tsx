"use client";

import { useState } from "react";

// The single most repeated interaction across every input session: click a
// question, get an answer. Used both as one big standalone "what is X"
// card and as a list of smaller detail-question cards.
export function RevealCard({
  question,
  answer,
  variant = "list",
}: {
  question: string;
  answer: string;
  variant?: "hero" | "list";
}) {
  const [open, setOpen] = useState(false);

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-[120px] max-w-md flex-col gap-3 rounded-[10px] border border-t-[3px] p-5 text-left transition-colors ${
          open ? "border-primary/30 border-t-primary bg-primary/5" : "border-border border-t-primary bg-card"
        }`}
      >
        {open ? (
          <>
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <span className="size-1.5 flex-none rounded-full bg-primary" />
              <p className="font-serif text-sm font-semibold text-ink">{question}</p>
            </div>
            <p className="text-[13.5px] leading-relaxed text-primary">{answer}</p>
          </>
        ) : (
          <>
            <div className="flex flex-1 items-center justify-center px-1 py-1.5 text-center">
              <p className="font-serif text-lg font-semibold leading-tight text-ink">{question}</p>
            </div>
            <p className="text-center text-[10.5px] font-semibold text-primary">Click to reveal ▾</p>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className="flex w-full flex-col gap-1.5 rounded-[8px] border border-border bg-card px-4 py-3 text-left"
    >
      <p className="text-xs text-ink">{question}</p>
      {open ? (
        <p className="border-t border-border pt-1 text-[11.5px] italic leading-relaxed text-primary">{answer}</p>
      ) : (
        <p className="text-[10.5px] font-semibold text-primary">Click to reveal ▾</p>
      )}
    </button>
  );
}
