"use client";

import { useActionState } from "react";
import { addCustomCapability, type OwnerActionState } from "@/app/centre/owner/actions";

const initial: OwnerActionState = { error: null };

export function AddCapabilityForm({ roleCols }: { roleCols: { key: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addCustomCapability, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="label"
        placeholder="Add a capability not on this list…"
        className="h-[37px] min-w-[220px] flex-1 rounded-md px-3.5 text-[12.5px]"
        style={{ border: "1px solid var(--owner-line)", background: "var(--owner-paper)" }}
      />
      <span className="text-[11.5px]" style={{ color: "var(--owner-muted)" }}>
        Give it to:
      </span>
      <select
        name="grant_to_role"
        className="h-[37px] rounded-md px-2.5 text-[11.5px]"
        style={{ border: "1px solid var(--owner-line)", background: "var(--owner-paper)" }}
      >
        {roleCols.map((rc) => (
          <option key={rc.key} value={rc.key}>
            {rc.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="cap-btn"
        style={{ background: "var(--owner-ink)", color: "white", borderColor: "var(--owner-ink)", padding: "9px 15px" }}
      >
        {pending ? "Adding…" : "Add capability"}
      </button>
      {state.error ? (
        <p className="w-full text-xs" style={{ color: "var(--owner-garnet)" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
