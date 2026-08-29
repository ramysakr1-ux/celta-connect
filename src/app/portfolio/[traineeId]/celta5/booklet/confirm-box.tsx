"use client";

import { useActionState } from "react";
import { confirmCelta5Section, type AbsenceFormState } from "@/app/portfolio/[traineeId]/status-actions";

const initial: AbsenceFormState = { error: null };

// The confirmation that closes each of the booklet's text sections.
//
// Shape is Ramy's, from his design file: the statement, then "Name:" and
// "Signed:" side by side, then the hint. Deliberately NOT a one-click
// button -- typing the name twice is the act of signing, and it reads on
// screen the way the paper booklet reads, which is the whole point of this
// screen (see booklet/shell.tsx).
export function ConfirmBox({
  section,
  text,
  confirmedAt,
  signatureName,
  canSign,
  fullName,
}: {
  section: string;
  text: string;
  confirmedAt: string | null;
  signatureName: string | null;
  canSign: boolean;
  fullName: string | null;
}) {
  const [state, formAction, pending] = useActionState(confirmCelta5Section, initial);

  if (confirmedAt) {
    return (
      <div className="c5-box" style={{ marginTop: 16 }}>
        <p className="text-[11px] leading-relaxed text-ink">{text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
          <span className="flex items-center gap-2">
            <span className="text-muted">Name:</span>
            <span className="font-semibold text-ink">{signatureName}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-muted">Signed:</span>
            <span className="font-semibold text-ink">
              {new Date(confirmedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (!canSign) {
    return (
      <div className="c5-box" style={{ marginTop: 16 }}>
        <p className="text-[11px] leading-relaxed text-ink">{text}</p>
        <p className="mt-2 text-[10px] italic text-muted">Not yet signed by the candidate.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="c5-box" style={{ marginTop: 16 }}>
      <input type="hidden" name="section" value={section} />
      <p className="text-[11px] leading-relaxed text-ink">{text}</p>
      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[11px]">
          <span className="w-14 text-muted">Name:</span>
          <input
            type="text"
            name="typed_name"
            required
            defaultValue={fullName ?? ""}
            className="c5-line"
            style={{ width: 260 }}
          />
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          <span className="w-14 text-muted">Signed:</span>
          <input type="text" name="typed_signature" required className="c5-line" style={{ width: 260 }} />
        </label>
      </div>
      {state.error ? <p className="mt-2 text-[10px] text-destructive">{state.error}</p> : null}
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="c5-btn">
          {pending ? "Saving…" : "Confirm"}
        </button>
        <span className="text-[9px] text-muted">
          Type your name both next to &ldquo;Name&rdquo; and &ldquo;Signed&rdquo; to sign this section.
        </span>
      </div>
    </form>
  );
}
