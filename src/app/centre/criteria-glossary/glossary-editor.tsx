"use client";

import { useActionState, useState } from "react";
import {
  removeGlossaryTerm,
  saveGlossaryTerm,
  setGlossaryTermEnabled,
} from "@/app/centre/criteria-glossary/actions";

export interface GlossaryTermView {
  term: string;
  codes: string[];
  enabled: boolean;
  builtIn: boolean;
  changed: boolean;
  editorName: string | null;
  updatedAt: string | null;
}

const initial = { error: null as string | null };

export function GlossaryEditorPanel({
  builtIn,
  ownTerms,
  criteriaLabels,
}: {
  builtIn: GlossaryTermView[];
  ownTerms: GlossaryTermView[];
  criteriaLabels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(saveGlossaryTerm, initial);
  const [editing, setEditing] = useState<GlossaryTermView | null>(null);
  const [query, setQuery] = useState("");

  const matches = (t: GlossaryTermView) =>
    !query.trim() ||
    t.term.includes(query.trim().toLowerCase()) ||
    t.codes.some((c) => c.includes(query.trim().toLowerCase()));

  return (
    <>
      <div className="sheet flex flex-col gap-3 p-6">
        <h2 className="font-serif text-lg text-ink">{editing ? `Edit "${editing.term}"` : "Add a term"}</h2>
        <p className="text-sm text-muted">
          One word or phrase as a tutor would actually type it, and the codes it should attach. Separate codes with
          spaces or commas.
        </p>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-sm text-muted">
            Word or phrase
            <input
              key={editing?.term ?? "new"}
              name="term"
              defaultValue={editing?.term ?? ""}
              readOnly={Boolean(editing)}
              placeholder="e.g. nomination"
              className="h-9 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary read-only:text-muted"
            />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col gap-1.5 text-sm text-muted">
            Criteria codes
            <input
              key={`${editing?.term ?? "new"}-codes`}
              name="codes"
              defaultValue={editing?.codes.join(" ") ?? ""}
              placeholder="e.g. 5c 5d"
              className="h-9 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-[6px] bg-primary px-4 text-sm font-medium text-card disabled:opacity-60"
          >
            {pending ? "Saving…" : editing ? "Save" : "Add"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-9 rounded-[6px] border border-border px-4 text-sm text-ink"
            >
              Cancel
            </button>
          ) : null}
        </form>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </div>

      <div className="sheet p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-ink">Every term</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a word or a code"
            className="h-9 w-56 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </div>

        {ownTerms.length > 0 ? (
          <Section
            title="Your centre's own"
            blurb="Added here. Remove one and it is gone."
            terms={ownTerms.filter(matches)}
            criteriaLabels={criteriaLabels}
            onEdit={setEditing}
          />
        ) : null}

        <Section
          title="The ones Connect ships with"
          blurb="Change what one tags, or switch it off for this centre. Switching off never deletes it — you can put it back."
          terms={builtIn.filter(matches)}
          criteriaLabels={criteriaLabels}
          onEdit={setEditing}
        />
      </div>
    </>
  );
}

function Section({
  title,
  blurb,
  terms,
  criteriaLabels,
  onEdit,
}: {
  title: string;
  blurb: string;
  terms: GlossaryTermView[];
  criteriaLabels: Record<string, string>;
  onEdit: (t: GlossaryTermView) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{title}</p>
      <p className="mt-0.5 text-xs text-muted">{blurb}</p>
      <ul className="mt-2 flex flex-col">
        {terms.length === 0 ? (
          <li className="py-3 text-sm text-muted">Nothing matches.</li>
        ) : (
          terms.map((t) => (
            <li
              key={t.term}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border-faint py-2.5 last:border-b-0"
            >
              <span className={`min-w-[150px] text-sm font-medium ${t.enabled ? "text-ink" : "text-muted line-through"}`}>
                {t.term}
              </span>
              <span className="flex flex-wrap gap-1">
                {t.codes.map((code) => (
                  <span key={code} className="badge-solid" title={criteriaLabels[code] ?? code}>
                    {code}
                  </span>
                ))}
              </span>
              {t.changed && t.editorName ? (
                <span className="text-xs text-muted">changed by {t.editorName}</span>
              ) : null}
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="rounded-[6px] border border-border px-2.5 py-1 text-xs text-ink hover:border-primary"
                >
                  Edit
                </button>
                <form action={setGlossaryTermEnabled}>
                  <input type="hidden" name="term" value={t.term} />
                  <input type="hidden" name="enabled" value={t.enabled ? "0" : "1"} />
                  <button type="submit" className="rounded-[6px] border border-border px-2.5 py-1 text-xs text-ink hover:border-primary">
                    {t.enabled ? "Switch off" : "Switch on"}
                  </button>
                </form>
                {!t.builtIn ? (
                  <form action={removeGlossaryTerm}>
                    <input type="hidden" name="term" value={t.term} />
                    <button type="submit" className="rounded-[6px] border border-border px-2.5 py-1 text-xs text-destructive hover:border-destructive">
                      Remove
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
