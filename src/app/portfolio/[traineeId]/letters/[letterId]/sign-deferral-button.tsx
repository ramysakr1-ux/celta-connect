"use client";

import { useActionState } from "react";
import { signDeferralLetter, type AcknowledgeLetterState } from "@/app/portfolio/[traineeId]/letters-actions";
import { SetSignatureForm } from "@/components/set-signature-form";

const initialState: AcknowledgeLetterState = { error: null };

// Deferral is an agreement, not a notice -- a real signature, not the
// generic "I've read this" click every other formal letter uses.
export function SignDeferralButton({ letterId, signatureName, fullName }: { letterId: string; signatureName: string | null; fullName: string }) {
  const [state, action, pending] = useActionState(signDeferralLetter, initialState);

  if (!signatureName) {
    return <SetSignatureForm fullName={fullName} />;
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="letter_id" value={letterId} />
      <p className="text-sm text-muted">I agree to defer, on the terms set out above.</p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : `Sign as ${signatureName}`}
      </button>
    </form>
  );
}
