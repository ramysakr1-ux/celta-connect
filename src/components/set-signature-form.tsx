"use client";

import { useActionState } from "react";
import { setMySignature, type SignatureFormState } from "@/lib/signature-actions";

const initialState: SignatureFormState = { error: null };

// connect-build-specs-5-gaps-2026-08-21.md item 4: shown once, wherever a
// signature is first needed -- typed once, fixed for the course, reused
// everywhere after. Same shape for every role.
export function SetSignatureForm({ fullName }: { fullName: string }) {
  const [state, action, pending] = useActionState(setMySignature, initialState);

  return (
    <form action={action} className="flex flex-col gap-2 rounded-[6px] border border-dashed border-border p-3.5">
      <p className="text-sm font-medium text-ink">Set your signature</p>
      <p className="text-xs text-muted">
        Type your name once -- it&apos;s fixed for the course from then on, and every signature after this reuses it
        with a single click.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="signature_name"
          type="text"
          defaultValue={fullName}
          required
          className="flex-1 rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-[6px] bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save signature"}
        </button>
      </div>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
