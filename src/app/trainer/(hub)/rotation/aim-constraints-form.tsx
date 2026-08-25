"use client";

import { useState } from "react";
import { setTp78AimConstraints } from "@/app/trainer/(hub)/rotation/actions";
import { AIM_TYPES, AIM_TYPE_LABELS, type AimType } from "@/lib/aim-type";

export function AimConstraintsForm({
  tp7AllowedAimTypes,
  tp8AllowedAimTypes,
}: {
  tp7AllowedAimTypes: AimType[] | null;
  tp8AllowedAimTypes: AimType[] | null;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        await setTp78AimConstraints(formData);
        setPending(false);
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AimTypeCheckboxes name="tp7_aim_types" label="TP7" defaultValue={tp7AllowedAimTypes} />
        <AimTypeCheckboxes name="tp8_aim_types" label="TP8" defaultValue={tp8AllowedAimTypes} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink trainer-hover-fill disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save constraints"}
      </button>
    </form>
  );
}

function AimTypeCheckboxes({ name, label, defaultValue }: { name: string; label: string; defaultValue: AimType[] | null }) {
  const defaults = new Set(defaultValue ?? []);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-muted">{label}</p>
      <div className="flex flex-col gap-1">
        {AIM_TYPES.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name={name} value={t} defaultChecked={defaults.has(t)} className="size-3.5" />
            {AIM_TYPE_LABELS[t]}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-muted">None checked = every type offered.</p>
    </div>
  );
}
