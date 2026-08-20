"use client";

import { useActionState, useState } from "react";
import { setClassGrouping } from "@/app/trainer/(hub)/rotation/actions";

const initialState = { error: null as string | null };

const TP_NUMBERS = [1, 2, 3, 4, 5, 6];

export function ClassGroupingForm({ trainees }: { trainees: { id: string; full_name: string }[] }) {
  const [state, action, pending] = useActionState(setClassGrouping, initialState);
  const [traineeId, setTraineeId] = useState("");
  const [tpNumber, setTpNumber] = useState<number | "">("");
  const [classGrouping, setClassGroupingValue] = useState<"whole_class" | "one_to_one_or_small_group">("one_to_one_or_small_group");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <input type="hidden" name="class_grouping" value={classGrouping} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Trainee</label>
          <select
            value={traineeId}
            onChange={(e) => setTraineeId(e.target.value)}
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">— choose —</option>
            {trainees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">TP number</label>
          <select
            value={tpNumber}
            onChange={(e) => setTpNumber(e.target.value ? Number(e.target.value) : "")}
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">— choose —</option>
            {TP_NUMBERS.map((n) => (
              <option key={n} value={n}>
                TP{n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Grouping</label>
          <select
            value={classGrouping}
            onChange={(e) => setClassGroupingValue(e.target.value as typeof classGrouping)}
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="one_to_one_or_small_group">1-to-1 / small group</option>
            <option value="whole_class">Whole class</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted">
        Handbook: at most one of the six assessed TP lessons may be 1-to-1 or small group, and it must be planned
        that way in advance -- never the final two (TP7/TP8), and only for a round that&apos;s already assigned but
        not yet taught.
      </p>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending || !traineeId || tpNumber === ""}
        className="self-start rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save grouping"}
      </button>
    </form>
  );
}
