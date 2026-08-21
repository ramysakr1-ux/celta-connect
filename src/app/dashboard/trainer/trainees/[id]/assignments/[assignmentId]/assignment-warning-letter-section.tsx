"use client";

import { useState } from "react";
import { LetterIssueForm } from "@/app/dashboard/trainer/letter-issue-form";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

export function AssignmentWarningLetterSection({
  traineeId,
  assignmentId,
  draft,
  existingLetters,
}: {
  traineeId: string;
  assignmentId: string;
  draft: FormalLetterInput | null;
  existingLetters: { id: string; issued_at: string; acknowledged_at: string | null }[];
}) {
  const [showForm, setShowForm] = useState(existingLetters.length === 0);

  return (
    <div className="card border-status-warning-text p-6">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-status-warning-text uppercase">Formal notice · written assignments</p>
      <h2 className="mt-1 font-serif text-lg text-ink">Assignment warning letter</h2>
      <p className="mt-1 text-sm text-muted">
        A candidate must pass three of the four written assignments. Failing this one after its one resubmission
        means they cannot fail another.
      </p>

      {existingLetters.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {existingLetters.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint p-2.5">
              <div>
                <p className="text-sm text-ink">Issued {new Date(l.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                <p className="text-xs text-muted">{l.acknowledged_at ? `Acknowledged ${new Date(l.acknowledged_at).toLocaleDateString("en-GB")}` : "Awaiting acknowledgement"}</p>
              </div>
              <a href={`/api/formal-letter/${l.id}`} className="text-xs font-semibold text-primary hover:underline">
                Download →
              </a>
            </div>
          ))}
          {!showForm ? (
            <button type="button" onClick={() => setShowForm(true)} className="self-start text-xs text-primary hover:underline">
              Issue another
            </button>
          ) : null}
        </div>
      ) : null}

      {showForm && draft ? (
        <div className="mt-3">
          <LetterIssueForm
            traineeId={traineeId}
            letterType="assignment_warning"
            draft={draft}
            relatedAssignmentId={assignmentId}
            onIssued={() => setShowForm(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
