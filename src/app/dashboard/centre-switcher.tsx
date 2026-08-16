"use client";

import { useActionState } from "react";
import { switchCentre, type SwitchCentreState } from "@/app/dashboard/centre-switcher-action";

const initial: SwitchCentreState = {};

export interface SwitchableCentre {
  id: string;
  name: string;
  centerNumber: string | null;
}

/**
 * Two branches in two cities are two centres with two Cambridge centre
 * numbers, not one centre with sub-entities -- so this switches which centre
 * you are acting in, it never merges them. The number is shown alongside the
 * name precisely because they differ and it is the thing that prints on
 * reports.
 *
 * Rendered only when there is somewhere to switch to; a single-centre person
 * never sees a control that would do nothing.
 */
export function CentreSwitcher({ centres, activeId }: { centres: SwitchableCentre[]; activeId: string | null }) {
  const [state, action, pending] = useActionState(switchCentre, initial);

  if (centres.length < 2) return null;

  return (
    <form action={action} className="flex items-center gap-2">
      <select
        name="center_id"
        // Keyed on the active centre so it remounts when the switch lands.
        // Caught live: as an uncontrolled select it kept its old selection
        // after switching, so the header said "My Center" while the page below
        // showed the other branch -- the one place a stale label is genuinely
        // dangerous, since every number on screen is centre-scoped.
        key={activeId ?? "none"}
        defaultValue={activeId ?? centres[0]?.id}
        // Submitting on change keeps it to one action -- a separate "Go"
        // button next to a select is a click nobody wants to make.
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={pending}
        aria-label="Which centre you're working in"
        className="h-8 rounded-[6px] border border-border bg-card px-2 text-xs font-medium text-ink outline-none focus:border-primary disabled:opacity-60"
      >
        {centres.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.centerNumber ? ` · ${c.centerNumber}` : ""}
          </option>
        ))}
      </select>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
