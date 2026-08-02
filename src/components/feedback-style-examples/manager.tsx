"use client";

import { useActionState } from "react";
import {
  addStyleExample,
  updateStyleExample,
  deleteStyleExample,
  type FormState,
} from "@/app/dashboard/admin/settings/actions";
import type { Database } from "@/lib/supabase/types";

type StyleExample = Database["public"]["Tables"]["feedback_style_examples"]["Row"];

const initialState: FormState = { error: null };

const TONE_LABELS: Record<"direct" | "supportive", string> = {
  direct: "Direct examples",
  supportive: "Supportive examples",
};

export function FeedbackStyleExamplesManager({ examples }: { examples: StyleExample[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {(["direct", "supportive"] as const).map((tone) => (
        <ToneColumn
          key={tone}
          tone={tone}
          examples={examples.filter((e) => e.tone === tone)}
        />
      ))}
    </div>
  );
}

function ToneColumn({
  tone,
  examples,
}: {
  tone: "direct" | "supportive";
  examples: StyleExample[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-ink">{TONE_LABELS[tone]}</h3>

      {examples.length === 0 ? (
        <p className="text-sm text-muted">No examples yet.</p>
      ) : (
        examples.map((example) => <ExampleRow key={example.id} example={example} />)
      )}

      <AddExampleForm tone={tone} />
    </div>
  );
}

function ExampleRow({ example }: { example: StyleExample }) {
  const [state, action, pending] = useActionState(updateStyleExample, initialState);

  return (
    <div className="flex flex-col gap-1.5">
      <form action={action} className="flex flex-col gap-1.5">
        <input type="hidden" name="id" value={example.id} />
        <textarea
          name="example_text"
          rows={3}
          defaultValue={example.example_text}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-muted hover:text-ink disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </form>
      <form action={deleteStyleExample}>
        <input type="hidden" name="id" value={example.id} />
        <button type="submit" className="text-xs text-destructive hover:underline">
          Delete
        </button>
      </form>
    </div>
  );
}

function AddExampleForm({ tone }: { tone: "direct" | "supportive" }) {
  const [state, action, pending] = useActionState(addStyleExample, initialState);

  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-[6px] border border-border p-3">
      <input type="hidden" name="tone" value={tone} />
      <label className="text-sm text-muted">Add example</label>
      <textarea
        name="example_text"
        rows={3}
        placeholder="Paste a real piece of feedback in this tone…"
        className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-3 py-1.5 text-xs font-medium text-card disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
