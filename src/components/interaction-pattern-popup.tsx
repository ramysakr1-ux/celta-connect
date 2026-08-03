"use client";

import { useState } from "react";
import { INTERACTION_PATTERNS } from "@/lib/tp-plan-content";

// Free-text interaction-pattern box with a click-to-insert popup of all
// patterns (full labels, not just codes) while focused -- same
// stays-open-while-clicking technique as PhonemicPopup. A second click
// appends rather than replaces, so two patterns can land in one box (e.g.
// "GW + PW"), and the field stays plain text underneath so typing directly
// always works too.
export function InteractionPatternPopup({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={className}
      />
      {open ? (
        <div className="absolute left-0 top-full z-10 mt-1 w-max max-w-xs rounded-[6px] border border-border bg-card p-2 shadow-md">
          <div className="flex flex-col gap-0.5">
            {INTERACTION_PATTERNS.map((p) => (
              <button
                key={p.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange(value.trim() ? `${value} + ${p.code}` : p.code)}
                className="rounded px-2 py-1 text-left text-xs text-ink hover:bg-background"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
