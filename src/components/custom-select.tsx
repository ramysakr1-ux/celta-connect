"use client";

import { useState } from "react";

// Generic replacement for native <select>: no browser dropdown arrow, the
// current choice (or a placeholder) reads centered in the box, and picking
// an option from the popup closes it -- single-choice, unlike
// InteractionPatternPopup/PhonemicPopup which stay open for repeated inserts.
export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "— choose —",
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="w-full rounded-[6px] border border-border bg-card px-3 py-2 text-center text-sm text-ink outline-none hover:border-primary disabled:opacity-60"
      >
        {selected ? selected.label : placeholder}
      </button>
      {open && !disabled ? (
        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-[6px] border border-border bg-card p-1 shadow-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="block w-full rounded px-2 py-1.5 text-center text-sm text-ink hover:bg-background"
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
