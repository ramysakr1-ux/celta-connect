"use client";

import { useActionState } from "react";
import { releaseWorkspace } from "@/app/dashboard/admissions/actions";
import type { FormState } from "@/app/dashboard/admissions/actions";

const initial: FormState = { error: null };

/**
 * The green light. Ramy, 2026-08-16: "before they receive the Connect link,
 * there should be a green light from the centre."
 *
 * The reason is a required choice rather than an optional note, because
 * "promised to pay" is the one a centre needs to be able to find later —
 * whoever is in on trust and still owes money. Burying that in free text means
 * nobody can list them.
 *
 * Deliberately one button and one select. Everything about who they are and
 * what they have paid is already on the screen above; this control only has to
 * answer "are we letting them in, and on what basis".
 */
export function ReleaseWorkspaceForm({
  applicantId,
  releasedAt,
  releasedReason,
  releasedByName,
  hasDeposit,
  specialRequirements,
}: {
  applicantId: string;
  releasedAt: string | null;
  releasedReason: string | null;
  releasedByName: string | null;
  hasDeposit: boolean;
  specialRequirements: string | null;
}) {
  const [state, formAction, pending] = useActionState(releaseWorkspace, initial);

  const REASON_LABEL: Record<string, string> = {
    paid_in_full: "Paid in full",
    deposit_paid: "Deposit paid",
    promised_to_pay: "Promised to pay",
    provider_confirmed: "Payment confirmed by the provider",
    other: "Other",
  };

  if (releasedAt) {
    return (
      <div className="rounded-[8px] border border-border bg-card p-4">
        <h3 className="font-serif text-base text-ink">Workspace access</h3>
        <p className="mt-1 text-sm text-muted">
          Released {new Date(releasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
          {releasedByName ? ` by ${releasedByName}` : ""}
          {releasedReason ? ` · ${REASON_LABEL[releasedReason] ?? releasedReason}` : ""}
        </p>
        <p className="mt-2 text-xs text-muted">
          Their workspace email has been sent. It won&apos;t send twice.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-border bg-card p-4">
      <h3 className="font-serif text-base text-ink">Workspace access</h3>
      <p className="mt-1 text-sm text-muted">
        They have no Connect link yet. Releasing it sends their workspace invitation, with the pre-course task and
        the reading list.
      </p>

      {specialRequirements ? (
        <p className="mt-2 rounded-[6px] border border-status-warning-text/30 bg-status-warning-text/10 px-3 py-2 text-xs text-status-warning-text">
          They flagged a special requirement -- worth checking it&apos;s in hand before releasing access:{" "}
          <span className="font-medium">&ldquo;{specialRequirements}&rdquo;</span>
        </p>
      ) : null}

      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="applicant_id" value={applicantId} />

        <label className="text-xs font-medium text-muted">Why are you giving access?</label>
        <select
          name="reason"
          defaultValue={hasDeposit ? "deposit_paid" : "promised_to_pay"}
          className="h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="paid_in_full">Paid in full</option>
          <option value="deposit_paid">Deposit paid</option>
          <option value="promised_to_pay">Promised to pay</option>
          <option value="provider_confirmed">Payment confirmed by the provider</option>
          <option value="other">Other — scholarship, staff place, transfer</option>
        </select>

        <input
          name="note"
          type="text"
          placeholder="Note (optional) — e.g. paying at the door on day one"
          className="h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
        />

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-[6px] bg-ink-warm px-4 py-2 text-sm font-semibold text-card disabled:opacity-60 admin-hover-fill"
        >
          {pending ? "Sending…" : "Release workspace access"}
        </button>
      </form>

      {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}
