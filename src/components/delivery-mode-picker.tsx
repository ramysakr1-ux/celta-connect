"use client";

import { DELIVERY_MODE_OPTIONS, DELIVERY_MODE_IMPACT, type DeliveryMode } from "@/lib/delivery-mode";

const TONE_CLASS: Record<"default" | "warning" | "danger", string> = {
  default: "text-ink",
  warning: "text-gold",
  danger: "text-destructive",
};

export function DeliveryModePicker({
  value,
  onChange,
}: {
  value: DeliveryMode;
  onChange: (mode: DeliveryMode) => void;
}) {
  const impact = DELIVERY_MODE_IMPACT[value];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-[9px]">
        {DELIVERY_MODE_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex items-start gap-3 rounded-[6px] border px-4 py-[15px] text-left transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span
                className={`mt-[2px] flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                  active ? "border-primary" : "border-border-faint"
                }`}
              >
                {active ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              {/* Course Admin.dc.html: label 13px/600 ink, description 12px
                  muted, 3px apart. The label does NOT change colour when
                  selected in the design -- the ring and the fill carry that. */}
              <span className="flex flex-1 flex-col gap-[3px]">
                <span className="text-[13px] font-semibold text-ink">{option.label}</span>
                <span className="text-xs text-muted">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={`flex flex-col gap-2 rounded-[6px] border px-4 py-3 ${
          impact.tone === "warning" ? "border-gold/40 bg-gold/10" : "border-primary/30 bg-primary/5"
        }`}
      >
        <p className={`text-[11px] font-semibold uppercase tracking-[0.09em] ${impact.tone === "warning" ? "text-gold" : "text-primary"}`}>
          {impact.heading}
        </p>
        <div className="flex flex-col gap-1.5">
          {impact.rows.map((row) => (
            <div key={row.what} className="flex items-start gap-2.5">
              <span className={`w-[110px] shrink-0 text-[11px] font-semibold ${TONE_CLASS[row.tone]}`}>{row.what}</span>
              <span className="text-xs leading-relaxed text-ink">{row.text}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted">You can change this until the timetable is locked.</p>
    </div>
  );
}
