"use client";

import { useActionState, useState } from "react";
import {
  transferCentreOwnership,
  type TransferOwnershipState,
  requestCentreDeleteCode,
  type RequestDeleteCodeState,
  deleteCentre,
  type DeleteCentreState,
} from "@/app/centre/settings/actions";

const transferInitial: TransferOwnershipState = { error: null };
const requestCodeInitial: RequestDeleteCodeState = { error: null, sent: false };
const deleteInitial: DeleteCentreState = { error: null };

// for-claude-code-centre-settings.md addendum: "type the centre's exact
// name into a text field before the destructive button unlocks -- same
// pattern as GitHub's repo-delete confirmation. This guards against an
// accidental click, not against an unauthorized actor; anyone who can
// already see this screen is already the centre owner" -- the role gate
// (page.tsx only renders this component for centre_owner) is the real
// boundary; this is misclick protection on top of it.
export function TransferOwnershipCard({ centreName }: { centreName: string }) {
  const [state, action, pending] = useActionState(transferCentreOwnership, transferInitial);
  const [confirmText, setConfirmText] = useState("");
  const unlocked = confirmText === centreName;

  return (
    <div className="rounded-[10px] border border-destructive/40 bg-card px-[22px] py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-base text-ink">Transfer centre ownership</h3>
          <p className="mt-1 text-sm text-muted">
            Hands the centre-owner role to someone else — they take on everything that role can do, including
            restoring deleted courses and appointing administrators. They must already have an account at this
            centre (invite them from Admin roster first).
          </p>
        </div>
      </div>
      <form action={action} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new_owner_email" className="text-sm text-muted">
            New owner&apos;s email
          </label>
          <input
            id="new_owner_email"
            name="new_owner_email"
            type="email"
            required
            className="max-w-sm rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm_name_transfer" className="text-sm text-muted">
            Type <span className="font-semibold text-ink">{centreName}</span> to confirm
          </label>
          <input
            id="confirm_name_transfer"
            name="confirm_name"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="max-w-sm rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={!unlocked || pending}
          className="self-start rounded-[6px] border border-destructive px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Transferring…" : "Transfer ownership"}
        </button>
      </form>
    </div>
  );
}

// "Delete this centre -- every course, candidate record, and CELTA 5 in
// the centre becomes inaccessible. Delete specifically also gets identity
// re-verification on top of the role gate and type-to-confirm: a
// confirmation code emailed to the owner, before the delete actually
// executes." Two forms, not one -- requesting the code is its own step so
// the code field only appears once an email has actually been sent, and
// the destructive submit stays disabled until both the typed name and a
// code are present.
export function DeleteCentreCard({ centreName }: { centreName: string }) {
  const [requestState, requestAction, requestPending] = useActionState(requestCentreDeleteCode, requestCodeInitial);
  const [deleteState, deleteActionFn, deletePending] = useActionState(deleteCentre, deleteInitial);
  const [confirmText, setConfirmText] = useState("");
  const [code, setCode] = useState("");
  const unlocked = confirmText === centreName && code.trim().length > 0;

  return (
    <div className="rounded-[10px] border border-destructive/40 bg-card px-[22px] py-5">
      <div>
        <h3 className="font-serif text-base text-ink">Delete this centre</h3>
        <p className="mt-1 text-sm text-muted">
          Permanent. Every course, candidate record, and CELTA 5 in the centre becomes inaccessible in Connect
          immediately — there is no grace period and no way to undo this. Any course not already archived is
          exported to your centre&apos;s Drive first, the same archive a normal close-out produces, so nothing
          covered by Cambridge&apos;s own retention rules is lost. This is not the same as a course close-out.
        </p>
      </div>

      {!requestState.sent ? (
        <form action={requestAction} className="mt-4">
          {requestState.error ? <p className="mb-3 text-sm text-destructive">{requestState.error}</p> : null}
          <button
            type="submit"
            disabled={requestPending}
            className="self-start rounded-[6px] border border-destructive px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {requestPending ? "Sending code…" : "Send me a confirmation code"}
          </button>
        </form>
      ) : (
        <form action={deleteActionFn} className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-ink">
            A confirmation code was emailed to you. It expires in 15 minutes.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm_name_delete" className="text-sm text-muted">
              Type <span className="font-semibold text-ink">{centreName}</span> to confirm
            </label>
            <input
              id="confirm_name_delete"
              name="confirm_name"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="max-w-sm rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete_code" className="text-sm text-muted">
              Confirmation code
            </label>
            <input
              id="delete_code"
              name="code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="max-w-[160px] rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          {deleteState.error ? <p className="text-sm text-destructive">{deleteState.error}</p> : null}
          <button
            type="submit"
            disabled={!unlocked || deletePending}
            className="self-start rounded-[6px] bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deletePending ? "Deleting…" : "Permanently delete this centre"}
          </button>
        </form>
      )}
    </div>
  );
}
