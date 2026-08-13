"use client";

import { useActionState, useMemo, useState } from "react";
import { overrideTpPoint, type FormState } from "@/app/trainer/(hub)/rotation/override/actions";

const initialState: FormState = { error: null };

interface TpPointOption {
  id: string;
  tp_number: number;
  tp_coursebook_id: string;
  main_lesson_aim: string;
  sub_aim: string | null;
  short_title: string | null;
  aim_type: string | null;
  density_tier: string;
}

const AIM_TYPE_LABEL: Record<string, string> = {
  grammar: "Grammar",
  lexis: "Lexis",
  function: "Function",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

export function OverrideForm({
  trainees,
  tpNumbers,
  scheduledTpNumbers,
  points,
}: {
  trainees: { id: string; full_name: string }[];
  tpNumbers: number[];
  scheduledTpNumbers: number[];
  points: TpPointOption[];
}) {
  const [state, action, pending] = useActionState(overrideTpPoint, initialState);
  const [traineeId, setTraineeId] = useState("");
  const [tpNumber, setTpNumber] = useState<number | "">("");
  const [tpPointId, setTpPointId] = useState("");

  const scheduledSet = useMemo(() => new Set(scheduledTpNumbers), [scheduledTpNumbers]);

  const pointsForTp = useMemo(() => (tpNumber === "" ? [] : points.filter((p) => p.tp_number === tpNumber)), [points, tpNumber]);

  const grouped = useMemo(() => {
    const groups = new Map<string, TpPointOption[]>();
    for (const p of pointsForTp) {
      const key = p.aim_type ?? "other";
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    return groups;
  }, [pointsForTp]);

  return (
    <form action={action} className="sheet flex flex-col gap-4 p-6">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <input type="hidden" name="tp_number" value={tpNumber} />
      <input type="hidden" name="tp_point_id" value={tpPointId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            onChange={(e) => {
              setTpNumber(e.target.value ? Number(e.target.value) : "");
              setTpPointId("");
            }}
            className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">— choose —</option>
            {tpNumbers.map((n) => (
              <option key={n} value={n} disabled={!scheduledSet.has(n)}>
                TP{n}
                {!scheduledSet.has(n) ? " (no coursebook scheduled)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tpNumber !== "" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">TP point</label>
          {pointsForTp.length === 0 ? (
            <p className="text-sm text-muted">No published TP points for TP{tpNumber} yet.</p>
          ) : (
            <select
              value={tpPointId}
              onChange={(e) => setTpPointId(e.target.value)}
              className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="">— choose —</option>
              {[...grouped.entries()].map(([aimType, list]) => (
                <optgroup key={aimType} label={AIM_TYPE_LABEL[aimType] ?? "Other"}>
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.short_title || p.main_lesson_aim}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          {tpPointId ? (
            <p className="text-xs text-muted">
              {points.find((p) => p.id === tpPointId)?.main_lesson_aim}
              {points.find((p) => p.id === tpPointId)?.sub_aim
                ? ` — ${points.find((p) => p.id === tpPointId)?.sub_aim}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending || !traineeId || tpNumber === "" || !tpPointId}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Assigning…" : "Assign this point"}
      </button>
    </form>
  );
}
