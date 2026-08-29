"use client";

import { useState } from "react";
import { acceptAssessorTerms } from "@/app/assessor/gate/actions";

// Reworded 29 Aug 2026 on Ramy's instruction -- "not happy with the
// wording... see if there's anything about assessor disclaimer wordings we
// can use instead". The Administration Handbook has no ready-made assessor
// declaration (it is written for centres, not as terms an assessor ticks),
// so nothing could be lifted verbatim. These are grounded in the passages
// that ARE on point:
//
//   1. unchanged from the original three (Certificates and Emails.dc.html),
//      and matching CELTA 5's own "Cambridge English does not retain copies
//      of portfolios";
//   2. merges the original confidentiality term with Admin Handbook 2.4.6:
//      "The assessor's report is the property of Cambridge, confidential,
//      and must not be quoted from or used for advertising";
//   3. promotes to a term the condition specs/ASSESSOR-GATE-TERMS.md had
//      noted was only ever stated in prose.
//
// Dropped: "I will not attempt to copy, reverse engineer, or reuse how this
// platform works." A software licence clause put to a visiting Cambridge
// assessor before they can do their job -- out of place, and not something
// any Cambridge document asks of them.
const TERMS = [
  "I will use this material only to assess this course, and will not copy, share or retain it.",
  "This material is confidential to the candidates and the centre, and my report is confidential to Cambridge.",
  "My access ends when the course closes.",
];

export function AssessorTermsForm() {
  const [checked, setChecked] = useState<boolean[]>(TERMS.map(() => true));
  const [pending, setPending] = useState(false);
  const allChecked = checked.every(Boolean);

  return (
    <form
      action={async () => {
        setPending(true);
        await acceptAssessorTerms();
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Terms of access</p>
      <div className="flex flex-col gap-3">
        {TERMS.map((text, i) => (
          <label key={i} className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
              className="mt-0.5 size-4 shrink-0 accent-ink"
            />
            <span>{text}</span>
          </label>
        ))}
      </div>
      {/* This note used to say access ends when the course closes; that is now
          the third tick, so it says what "closes" means instead of repeating it. */}
      <p className="text-xs text-muted">
        The course closes once the centre submits final results to Cambridge. The link stops working then, and nothing here is available afterwards.
      </p>
      <button
        type="submit"
        disabled={!allChecked || pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Opening…" : "Agree and open the pack"}
      </button>
    </form>
  );
}
