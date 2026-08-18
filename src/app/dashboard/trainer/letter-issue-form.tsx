"use client";

import { useActionState, useState } from "react";
import { issueFormalLetter, type FormState } from "@/app/dashboard/trainer/letters-actions";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

const initialState: FormState = { error: null };

// "Written by the system, signed by a person" -- the facts are read-only
// (auto-derived, shown for review), the two prose fields a tutor would
// actually want to revise (the action-points/criteria list, and the
// closing paragraph) are editable right here before issuing.
export function LetterIssueForm({
  traineeId,
  letterType,
  draft,
  relatedAssignmentId,
  relatedDeferralTransferId,
  onIssued,
}: {
  traineeId: string;
  letterType: "fail_risk" | "assignment_warning" | "deferral";
  draft: FormalLetterInput;
  relatedAssignmentId?: string;
  relatedDeferralTransferId?: string;
  onIssued?: (letterId: string) => void;
}) {
  const [state, formAction, pending] = useActionState(issueFormalLetter, initialState);
  const [listItems, setListItems] = useState((draft.list?.items ?? []).join("\n"));
  const [closing, setClosing] = useState(draft.closing ?? "");

  if (state.letterId) {
    onIssued?.(state.letterId);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Issued.</p>
        <a href={`/api/formal-letter/${state.letterId}`} className="text-sm text-primary hover:underline">
          Download the letter →
        </a>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        const finalDraft: FormalLetterInput = {
          ...draft,
          list: draft.list ? { ...draft.list, items: listItems.split("\n").map((s) => s.trim()).filter(Boolean) } : undefined,
          closing: closing.trim() || undefined,
        };
        fd.set("snapshot", JSON.stringify(finalDraft));
        formAction(fd);
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="letter_type" value={letterType} />
      {relatedAssignmentId ? <input type="hidden" name="related_assignment_id" value={relatedAssignmentId} /> : null}
      {relatedDeferralTransferId ? <input type="hidden" name="related_deferral_transfer_id" value={relatedDeferralTransferId} /> : null}

      <div className="rounded-[6px] border border-border-faint bg-surface-muted/40 p-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{draft.docTitle}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {draft.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted">{f.label}</dt>
              <dd className="text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {draft.list ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">{draft.list.title}</label>
          <textarea
            value={listItems}
            onChange={(e) => setListItems(e.target.value)}
            rows={4}
            placeholder="One point per line"
            className="rounded-[6px] border border-border bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">Closing</label>
        <textarea
          value={closing}
          onChange={(e) => setClosing(e.target.value)}
          rows={3}
          className="rounded-[6px] border border-border bg-card px-2.5 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Issuing…" : "Issue the letter"}
      </button>
    </form>
  );
}
