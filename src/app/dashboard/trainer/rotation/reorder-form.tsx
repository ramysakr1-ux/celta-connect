"use client";

import { useActionState } from "react";
import { reorderSubgroup, type FormState } from "@/app/dashboard/trainer/rotation-actions";

const initialState: FormState = { error: null };

export function ReorderForm({
  subgroupId,
  members,
}: {
  subgroupId: string;
  members: { traineeId: string; fullName: string; baseSlot: number }[];
}) {
  const [state, action, pending] = useActionState(reorderSubgroup, initialState);
  const ordered = [...members].sort((a, b) => a.baseSlot - b.baseSlot);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="subgroup_id" value={subgroupId} />
      {ordered.map((m) => (
        <div key={m.traineeId} className="flex items-center gap-3">
          <span className="w-40 text-ink">{m.fullName}</span>
          <label className="text-sm text-muted" htmlFor={`position__${m.traineeId}`}>
            Position
          </label>
          <select
            id={`position__${m.traineeId}`}
            name={`position__${m.traineeId}`}
            defaultValue={m.baseSlot + 1}
            className="appearance-none rounded-[6px] border border-border bg-card px-2 py-1 text-center text-sm text-ink outline-none focus:border-primary"
          >
            {ordered.map((_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      ))}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save order"}
      </button>
    </form>
  );
}
