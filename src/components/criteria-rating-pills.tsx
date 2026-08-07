"use client";

const RATING_VALUES = ["S+", "S", "N", "X"] as const;

// Shared S+/S/N/X pill picker for the CELTA5 criteria matrix -- clicking the
// already-selected pill clears it (toggle), so no separate "clear" control
// is needed. Used by both the candidate self-assessment and tutor rating
// forms; kept dumb/controlled so each caller owns its own state shape
// (tutor side also needs a separate "suggested" affordance next to this).
export function CriteriaRatingPills({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {RATING_VALUES.map((opt) => (
        <button
          key={opt}
          type="button"
          aria-pressed={value === opt}
          onClick={() => onChange(value === opt ? "" : opt)}
          className={`rounded-[6px] border px-2 py-1 text-xs font-medium transition-colors ${
            value === opt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted hover:border-primary hover:text-ink"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
