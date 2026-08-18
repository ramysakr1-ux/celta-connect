"use client";

import { useState } from "react";

const ARRANGEMENTS = [
  "Extended time for assignments",
  "Materials in advance",
  "Written instructions",
  "A quiet room for TP prep",
  "Screen-reader friendly files",
  "Something else",
];

// Enrolment Forms.dc.html 1b. Shared between join-form.tsx and offer-
// accept-form.tsx -- both are "day one, signed once" account-creation
// moments the design treats as the same screen.
export function SpecialConsiderationFields({ defaultText, defaultArrangements = [] }: { defaultText?: string | null; defaultArrangements?: string[] }) {
  const [declared, setDeclared] = useState(Boolean(defaultText) || defaultArrangements.length > 0);
  const [picked, setPicked] = useState<Set<string>>(new Set(defaultArrangements));

  function toggle(label: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">Is there anything we should know?</p>
        <p className="text-xs text-muted">
          If you have a condition or circumstance that affects how you work -- dyslexia, a health condition, caring
          responsibilities -- tell us now rather than later. It does not appear on your certificate and it does not
          change the standard you are assessed against. It changes what we arrange.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className={`flex cursor-pointer items-start gap-2.5 rounded-[6px] border p-2.5 ${declared ? "border-primary bg-primary/5" : "border-border"}`}>
          <input type="radio" name="sc_declared" checked={declared} onChange={() => setDeclared(true)} className="mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink">Yes, there is something</p>
            <p className="text-xs text-muted">A condition, a health issue, or a circumstance affecting how you work.</p>
          </div>
        </label>
        <label className={`flex cursor-pointer items-start gap-2.5 rounded-[6px] border p-2.5 ${!declared ? "border-primary bg-primary/5" : "border-border"}`}>
          <input type="radio" name="sc_declared" checked={!declared} onChange={() => setDeclared(false)} className="mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink">No, nothing to declare</p>
            <p className="text-xs text-muted">You can add this later -- conditions and circumstances change mid-course.</p>
          </div>
        </label>
      </div>

      {declared ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted">What would help</p>
            <div className="flex flex-wrap gap-1.5">
              {ARRANGEMENTS.map((label) => {
                const on = picked.has(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggle(label)}
                    aria-pressed={on}
                    className={`h-8 rounded-full border px-3 text-xs font-medium ${
                      on ? "border-primary bg-primary/10 text-ink" : "border-border text-muted hover:border-primary hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {[...picked].map((label) => (
              <input key={label} type="hidden" name="special_consideration_arrangements" value={label} />
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="special_consideration" className="text-xs text-muted">
              Tell us in your own words
            </label>
            <textarea
              id="special_consideration"
              name="special_consideration"
              rows={2}
              defaultValue={defaultText ?? ""}
              placeholder="Write or dictate…"
              className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="special_consideration_evidence" className="text-xs text-muted">
              Supporting evidence, if you have any
            </label>
            <input
              id="special_consideration_evidence"
              name="special_consideration_evidence"
              type="file"
              className="text-sm text-ink file:mr-3 file:rounded-[6px] file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:text-ink"
            />
          </div>

          <p className="rounded-[6px] border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-ink">
            Only the course tutors and the centre see this. It is not visible to other candidates, and it is not sent
            to Cambridge unless an extension is later requested on your behalf.
          </p>
        </div>
      ) : (
        <input type="hidden" name="special_consideration_declined" value="1" />
      )}
    </div>
  );
}
