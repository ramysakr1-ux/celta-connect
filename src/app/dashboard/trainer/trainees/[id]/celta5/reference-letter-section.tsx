"use client";

import { useState } from "react";
import { LetterIssueForm } from "@/app/dashboard/trainer/letter-issue-form";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

// for-claude-code-reference-letter.md: "not required for every candidate...
// a tool the centre can use when they choose to" -- so this always starts
// collapsed behind the button, never expanded automatically the way
// FailRiskLetterSection is when there's no letter yet (that one is a
// compliance notice the tutor is expected to act on; this one is optional).
export function ReferenceLetterSection({
  traineeId,
  draft,
  existingLetters,
  canGenerate,
}: {
  traineeId: string;
  draft: FormalLetterInput | null;
  existingLetters: { id: string; issued_at: string }[];
  canGenerate: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="card p-6">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Optional</p>
      <h2 className="mt-1 font-serif text-lg text-ink">Reference letter</h2>
      <p className="mt-1 text-sm text-muted">
        A drafted reference from this candidate&apos;s real course record -- grade, TP feedback strengths, and
        attendance. Review and edit it before issuing; nothing is sent automatically.
      </p>

      {existingLetters.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {existingLetters.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint p-2.5">
              <p className="text-sm text-ink">
                Issued {new Date(l.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <a href={`/api/formal-letter/${l.id}`} className="text-xs font-semibold text-primary hover:underline">
                Download →
              </a>
            </div>
          ))}
        </div>
      ) : null}

      {!draft ? (
        <p className="mt-3 text-sm text-muted">Available once this candidate has a finalized grade.</p>
      ) : !canGenerate ? (
        <p className="mt-3 text-sm text-muted">Only the main course tutor or a centre admin can issue this.</p>
      ) : !showForm ? (
        <button type="button" onClick={() => setShowForm(true)} className="mt-3 self-start text-sm text-primary hover:underline">
          {existingLetters.length > 0 ? "Generate another" : "Generate reference letter"}
        </button>
      ) : (
        <div className="mt-3">
          <LetterIssueForm traineeId={traineeId} letterType="reference" draft={draft} onIssued={() => setShowForm(false)} />
        </div>
      )}
    </div>
  );
}
