"use client";

import { useState } from "react";
import { LetterIssueForm } from "@/app/dashboard/trainer/letter-issue-form";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

export function DeferralLetterSection({
  traineeId,
  deferralTransferId,
  draft,
  existingLetters,
}: {
  traineeId: string;
  deferralTransferId: string;
  draft: FormalLetterInput | null;
  existingLetters: { id: string; issued_at: string; acknowledged_at: string | null }[];
}) {
  const [showForm, setShowForm] = useState(existingLetters.length === 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Deferral letter</p>
      {existingLetters.map((l) => (
        <div key={l.id} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted">
            Issued {new Date(l.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
            {l.acknowledged_at ? "acknowledged" : "awaiting acknowledgement"}
          </span>
          <a href={`/api/formal-letter/${l.id}`} className="font-semibold text-primary hover:underline">
            Download →
          </a>
        </div>
      ))}
      {!showForm && existingLetters.length > 0 ? (
        <button type="button" onClick={() => setShowForm(true)} className="self-start text-xs text-primary hover:underline">
          Issue another
        </button>
      ) : null}
      {showForm && draft ? (
        <LetterIssueForm
          traineeId={traineeId}
          letterType="deferral"
          draft={draft}
          relatedDeferralTransferId={deferralTransferId}
          onIssued={() => setShowForm(false)}
        />
      ) : null}
    </div>
  );
}
