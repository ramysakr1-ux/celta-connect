"use client";

import { useActionState } from "react";
import { removeCustomRole, type OwnerActionState } from "@/app/centre/owner/actions";

const initial: OwnerActionState = { error: null };

// Sits in a custom role's column header. Built-in roles never get one.
export function RemoveRoleForm({ roleKey, label }: { roleKey: string; label: string }) {
  const [state, action, pending] = useActionState(removeCustomRole, initial);
  return (
    <form
      action={action}
      className="mt-1 flex flex-col items-center gap-1"
      onSubmit={(e) => {
        if (!window.confirm(`Remove the role "${label}"? Its capability settings go with it.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="role_key" value={roleKey} />
      <button type="submit" disabled={pending} className="wash rounded px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal" style={{ color: "var(--owner-garnet)" }}>
        {pending ? "Removing…" : "Remove role"}
      </button>
      {state.error ? (
        <span className="max-w-[160px] text-[10px] font-normal normal-case tracking-normal" style={{ color: "var(--owner-garnet)" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
