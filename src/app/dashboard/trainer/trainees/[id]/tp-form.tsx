"use client";

import { useActionState } from "react";
import { updateTp, type FormState } from "@/app/dashboard/trainer/actions";
import type { Database } from "@/lib/supabase/types";

type Tp = Database["public"]["Tables"]["tps"]["Row"];

const initialState: FormState = { error: null };

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function TpForm({ tp }: { tp: Tp }) {
  const [state, action, pending] = useActionState(updateTp, initialState);

  return (
    <form action={action} className="card flex flex-col gap-3 p-4">
      <input type="hidden" name="tp_id" value={tp.id} />
      <input type="hidden" name="trainee_id" value={tp.trainee_id} />

      <h3 className="font-serif text-ink">TP{tp.tp_number}</h3>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Main aim</label>
        <input
          name="main_aim"
          type="text"
          defaultValue={tp.main_aim ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Sub aim</label>
        <input
          name="sub_aim"
          type="text"
          defaultValue={tp.sub_aim ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Scheduled</label>
        <input
          name="scheduled_at"
          type="datetime-local"
          defaultValue={toDatetimeLocal(tp.scheduled_at)}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">Observation notes</label>
        <textarea
          name="observation_notes"
          rows={3}
          defaultValue={tp.observation_notes ?? ""}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
