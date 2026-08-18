"use client";

import { useState } from "react";
import { acceptAssessorTerms } from "@/app/assessor/gate/actions";

// Invitations.dc.html screen 1d: three items pre-checked (affirmations of
// good-faith intent), the access-ends clause left unchecked by default so
// it's the one term an assessor actively has to read and tick themselves,
// not sweep along with the others. All four are required before the
// button opens.
const TERMS = [
  { text: "I will use this material only for the assessment of this course.", defaultChecked: true },
  { text: "I will not copy, download, share or store it outside the assessment process.", defaultChecked: true },
  { text: "I will keep candidate and student information confidential.", defaultChecked: true },
  {
    text: "I understand my access ends when the course closes, and the material is no longer available here after that.",
    defaultChecked: false,
  },
];

export function AssessorTermsForm() {
  const [checked, setChecked] = useState<boolean[]>(TERMS.map((t) => t.defaultChecked));
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
        {TERMS.map((term, i) => (
          <label key={i} className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
              className="mt-0.5 size-4 shrink-0 accent-ink"
            />
            <span>{term.text}</span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={!allChecked || pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Opening…" : "Accept and open the pack"}
      </button>
    </form>
  );
}
