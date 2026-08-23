"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createStage2Block, type FormState } from "@/app/trainer/(hub)/timetable/stage2-actions";

const initialState: FormState = { error: null };

interface Group {
  kind: "tpgroup" | "subgroup";
  id: string;
  name: string;
}

interface BlockSummary {
  id: string;
  groupName: string;
  eventDate: string;
}

// for-claude-code-trainer-remaining-screens.md §3a -- "the tutor places a
// Stage 2 tutorial block on the timetable for their own TP group only --
// date, start time, duration. No slot count is entered."
export function Stage2Section({ groups, blocks }: { groups: Group[]; blocks: BlockSummary[] }) {
  const [state, formAction, pending] = useActionState(createStage2Block, initialState);

  return (
    <div className="sheet flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-lg text-ink">Stage 2 tutorials</h2>
        <p className="mt-1 text-sm text-muted">
          Book-your-own-slot sheet for one TP group. Positions, not clock times -- 1st, 2nd, 3rd... around 15–20 min
          each.
        </p>
      </div>

      {blocks.length > 0 ? (
        <div className="flex flex-col gap-1">
          {blocks.map((b) => (
            <Link
              key={b.id}
              href={`/trainer/timetable/stage2/${b.id}`}
              className="flex items-center justify-between rounded-[6px] border border-border-faint px-3 py-2 text-sm text-ink trainer-hover"
            >
              <span>{b.groupName}</span>
              <span className="text-xs text-muted">{b.eventDate}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-sm text-muted">No TP groups set up yet.</p>
      ) : (
        <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select
            name="scope"
            required
            onChange={(e) => {
              const opt = e.target.selectedOptions[0];
              const form = e.target.form;
              if (form) (form.elements.namedItem("group_label") as HTMLInputElement).value = opt?.text ?? "";
            }}
            className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="" disabled selected>
              Choose a group
            </option>
            {groups.map((g) => (
              <option key={g.id} value={`${g.kind === "tpgroup" ? "tpgroup" : "subgroup"}:${g.id}`}>
                {g.name}
              </option>
            ))}
          </select>
          <input type="hidden" name="group_label" />
          <input
            name="event_date"
            type="date"
            required
            className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <input
            name="event_time"
            type="time"
            required
            className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <input
            name="duration_minutes"
            type="number"
            min={15}
            step={15}
            defaultValue={90}
            required
            placeholder="Duration (min)"
            className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
          {state.error ? <p className="text-sm text-destructive sm:col-span-4">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-4"
          >
            {pending ? "Adding…" : "Add Stage 2 tutorial block"}
          </button>
        </form>
      )}
    </div>
  );
}
