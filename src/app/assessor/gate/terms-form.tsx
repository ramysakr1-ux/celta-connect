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
//   2. merges the original confidentiality term with Administration
//      Handbook 14.5, "The assessor's report" (printed p41): "The
//      assessor's report is the property of Cambridge, must be treated
//      confidentially and must not be quoted from or used for advertising
//      purposes." The quote was right; the section number said 2.4.6, which
//      is not a section of the June 2025 Handbook at all -- section 2 is
//      Useful contacts. Corrected against the PDF 15 Sep 2026.
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
  "My access ends when the centre clears the course from Connect.",
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
      <p className="text-label font-semibold tracking-[0.1em] text-muted uppercase">Terms of access</p>
      <div className="flex flex-col gap-3">
        {TERMS.map((text, i) => (
          <label key={i} className="flex items-start gap-2.5 text-body text-ink">
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
      {/* The note says what the third tick MEANS rather than repeating it.
          Reworded 18 Sep 2026 with the link's own rule: it used to end two
          weeks after the course, and now ends when the working copy does. */}
      <p className="text-label text-muted">
        After the course the centre exports its records and the working copy here is deleted. The link stops working
        then, and nothing here is available afterwards. The centre keeps the pack.
      </p>
      <button
        type="submit"
        disabled={!allChecked || pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-body font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Opening…" : "Agree and open the pack"}
      </button>
    </form>
  );
}
