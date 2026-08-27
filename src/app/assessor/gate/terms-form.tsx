"use client";

import { useState } from "react";
import { acceptAssessorTerms } from "@/app/assessor/gate/actions";

// specs/ASSESSOR-GATE-TERMS.md: the three terms verbatim from Certificates
// and Emails.dc.html, ruled authoritative over the differently-worded (and
// missing the reverse-engineering clause) Invitations.dc.html screen 1d
// this form used to follow. The "access ends when the course closes"
// condition is deliberately NOT a fourth checkbox here -- the spec treats
// it as information, already said by the pack email and the note below,
// not something to tick.
const TERMS = [
  "I will use this material only to assess this course, and will not copy, share or retain it.",
  "I will not attempt to copy, reverse engineer, or reuse how this platform works.",
  "I understand this material is confidential to the candidates and the centre.",
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
      <p className="text-xs text-muted">Access ends when the course closes -- the material is no longer available here after that.</p>
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
