"use client";

import { useActionState } from "react";
import { addCustomRole, type OwnerActionState } from "@/app/centre/owner/actions";

const initial: OwnerActionState = { error: null };

export function AddRoleForm() {
  const [state, action, pending] = useActionState(addCustomRole, initial);

  return (
    <form action={action} className="flex flex-col gap-1.5 border-t border-dashed pt-[15px]" style={{ borderColor: "var(--owner-line)" }}>
      <div className="flex items-center gap-2">
        <input
          name="label"
          placeholder="Add a new role — e.g. Centre Director, Across-course Administrator…"
          className="h-[37px] flex-1 rounded-md px-3.5 text-[12.5px]"
          style={{ border: "1px solid var(--owner-line)", background: "var(--owner-paper)" }}
        />
        <button
          type="submit"
          disabled={pending}
          className="cap-btn"
          style={{ background: "var(--owner-garnet)", color: "white", borderColor: "var(--owner-garnet)", padding: "9px 15px" }}
        >
          {pending ? "Adding…" : "Add role"}
        </button>
      </div>
      {state.error ? (
        <p className="text-xs" style={{ color: "var(--owner-garnet)" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
