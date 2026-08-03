"use client";

import { useState } from "react";
import { IPA_SYMBOL_GROUPS } from "@/lib/tp-plan-content";

// A phonemic-transcription textarea with the IPA symbol chart appearing as a
// popup while it's focused, rather than a permanently-visible row underneath
// every such field. Clicking a symbol inserts it without stealing focus from
// the textarea (onMouseDown preventDefault), so the popup stays open across
// several clicks and only closes when the trainee actually moves on.
export function PhonemicPopup({
  value,
  onChange,
  disabled,
  className,
  rows = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  rows?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <textarea
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`${className ?? ""} font-serif`}
      />
      {open && !disabled ? (
        <div className="absolute left-0 top-full z-10 mt-1 w-max max-w-md rounded-[6px] border border-border bg-card p-2 shadow-md">
          {IPA_SYMBOL_GROUPS.map((group) => (
            <div key={group.label} className="mb-1 flex flex-wrap items-center gap-1 last:mb-0">
              <span className="mr-1 text-xs text-muted">{group.label}:</span>
              {group.symbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChange(value + sym)}
                  className="rounded border border-border-faint px-1.5 py-0.5 font-serif text-sm hover:border-primary"
                >
                  {sym}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
