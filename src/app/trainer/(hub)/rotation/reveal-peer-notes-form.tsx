"use client";

import { useState } from "react";
import { revealPeerNotes } from "@/app/trainer/(hub)/rotation/actions";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

export function RevealPeerNotesForm({ subgroups }: { subgroups: { id: string; name: string }[] }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        await revealPeerNotes(formData);
        setPending(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <select
        name="subgroup_id"
        required
        defaultValue=""
        className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
      >
        <option value="" disabled>
          — half / subgroup —
        </option>
        {subgroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <select
        name="tp_number"
        required
        defaultValue=""
        className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
      >
        <option value="" disabled>
          — TP —
        </option>
        {TP_NUMBERS.map((n) => (
          <option key={n} value={n}>
            TP{n}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card disabled:opacity-60">
        {pending ? "Revealing…" : "Reveal notes"}
      </button>
    </form>
  );
}
