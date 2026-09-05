"use client";

import { useActionState, useState } from "react";
import { saveMarkingGuidanceEntry, type FormState } from "@/app/trainer/(hub)/marking-guidance/actions";
import type { AssignmentCriterion } from "@/lib/assignment-criteria";
import type { Database } from "@/lib/supabase/types";

type GuidanceRow = Database["public"]["Tables"]["marking_guidance_entries"]["Row"];
export type SerializedGuidance = Record<string, Record<string, GuidanceRow>>;

const initialState: FormState = { error: null };
const textareaClass =
  "w-full rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary";

export function MarkingGuidanceTabs({
  assignments,
  guidance,
  updaterNameById,
  initialType,
}: {
  assignments: { type: string; title: string; criteria: AssignmentCriterion[] }[];
  guidance: SerializedGuidance;
  updaterNameById: Record<string, string>;
  initialType: string;
}) {
  const [active, setActive] = useState(initialType);
  const current = assignments.find((a) => a.type === active) ?? assignments[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {assignments.map((a) => (
          <button
            key={a.type}
            type="button"
            onClick={() => setActive(a.type)}
            className={`rounded-[6px] border px-3.5 py-2 text-sm font-medium ${
              active === a.type
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:border-primary/50 hover:text-ink"
            }`}
          >
            {a.title}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {current.criteria.map((c, i) => (
          <CriterionCard
            key={c.key}
            assignmentType={current.type}
            index={i}
            criterion={c}
            row={guidance[current.type]?.[c.key]}
            updatedByName={
              guidance[current.type]?.[c.key]?.updated_by ? updaterNameById[guidance[current.type][c.key].updated_by!] : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function CriterionCard({
  assignmentType,
  index,
  criterion,
  row,
  updatedByName,
}: {
  assignmentType: string;
  index: number;
  criterion: AssignmentCriterion;
  row: GuidanceRow | undefined;
  updatedByName: string | undefined;
}) {
  const [state, action, pending] = useActionState(saveMarkingGuidanceEntry, initialState);

  return (
    <form action={action} className="card flex flex-col gap-4 border-l-[3px] border-l-primary p-5">
      <input type="hidden" name="assignment_type" value={assignmentType} />
      <input type="hidden" name="criterion_key" value={criterion.key} />

      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-xs font-semibold text-primary">{romanNumeral(index + 1)}</span>
        <p className="text-sm font-semibold text-ink">{criterion.text}</p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Field label="Enough to meet it" name="met_text" defaultValue={row?.met_text ?? ""} accent="text-primary" />
        <Field label="Centre judgement" name="grey_text" defaultValue={row?.grey_text ?? ""} accent="text-status-warning-text" />
        <Field label="Not yet" name="not_text" defaultValue={row?.not_text ?? ""} accent="text-destructive" />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border-faint pt-3.5">
        <label className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Agreed</label>
        <textarea
          name="agreed_text"
          rows={2}
          defaultValue={row?.agreed_text ?? ""}
          placeholder="The standardised decision, in a sentence or two."
          className={textareaClass}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {row?.updated_at ? `Last updated ${updatedByName ? `by ${updatedByName} ` : ""}${formatDate(row.updated_at)}` : "Not written yet"}
        </p>
        <div className="flex items-center gap-2">
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] border border-border px-3.5 py-1.5 text-sm text-ink hover:border-primary disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, accent }: { label: string; name: string; defaultValue: string; accent: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-xs font-semibold tracking-[0.06em] uppercase ${accent}`}>{label}</label>
      <textarea name={name} rows={4} defaultValue={defaultValue} placeholder="One per line" className={textareaClass} />
    </div>
  );
}

function romanNumeral(n: number): string {
  const numerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];
  return numerals[n - 1] ?? String(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
