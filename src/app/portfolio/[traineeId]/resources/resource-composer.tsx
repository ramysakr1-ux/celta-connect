"use client";

import { useActionState } from "react";
import { addResource, type FormState } from "@/app/portfolio/[traineeId]/resources/actions";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_CATEGORY_ORDER, RESOURCE_TYPE_LABELS, RESOURCE_TYPE_ORDER } from "@/lib/resource-info";

const initialState: FormState = { error: null };

export function ResourceComposer({ traineeId }: { traineeId: string }) {
  const action = addResource.bind(null, traineeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="sheet flex flex-col gap-3 border-primary/25 bg-accent/30">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Add a resource</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          type="text"
          placeholder="Title"
          required
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <input
          name="file_url"
          type="url"
          placeholder="Link (file, Drive, video...)"
          required
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
        <select
          name="category"
          defaultValue={RESOURCE_CATEGORY_ORDER[0]}
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        >
          {RESOURCE_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {RESOURCE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          name="resource_type"
          defaultValue={RESOURCE_TYPE_ORDER[0]}
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        >
          {RESOURCE_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {RESOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="description"
        placeholder="Short description (optional)"
        rows={2}
        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="center_wide" />
          Share across the whole center, not just this course
        </label>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add resource"}
        </button>
      </div>
    </form>
  );
}
