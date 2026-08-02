"use client";

import { useActionState, useState } from "react";
import type { TemplateSection } from "@/lib/assignment-templates/content";

export interface SectionEditorFormState {
  error: string | null;
}

const inputClass =
  "w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

function emptySection(): TemplateSection {
  return { key: `section_${Date.now()}`, title: "", instruction: "" };
}

export function SectionEditor({
  templateId,
  sections: initialSections,
  publishedAt,
  saveAction,
  publishAction,
  unpublishAction,
}: {
  templateId: string;
  sections: TemplateSection[];
  publishedAt: string | null;
  saveAction: (prevState: SectionEditorFormState, formData: FormData) => Promise<SectionEditorFormState>;
  publishAction: (formData: FormData) => Promise<void>;
  unpublishAction: (formData: FormData) => Promise<void>;
}) {
  const [sections, setSections] = useState<TemplateSection[]>(
    initialSections.length > 0 ? initialSections : [emptySection()]
  );
  const [state, formAction, pending] = useActionState(saveAction, { error: null });

  function updateSection(index: number, patch: Partial<TemplateSection>) {
    setSections(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="template_id" value={templateId} />
        <input type="hidden" name="sections" value={JSON.stringify(sections)} />

        {sections.map((section, i) => (
          <div key={section.key || i} className="rounded-[6px] border border-border-faint p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Section {i + 1}</span>
              <button
                type="button"
                onClick={() => setSections(sections.filter((_, x) => x !== i))}
                className="text-sm text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
                placeholder="Section title"
                className={inputClass}
              />
              <textarea
                rows={4}
                value={section.instruction}
                onChange={(e) => updateSection(i, { instruction: e.target.value })}
                placeholder="Instruction text for this section"
                className={inputClass}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setSections([...sections, emptySection()])}
          className="self-start rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary"
        >
          + Add section
        </button>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save sections"}
        </button>
      </form>

      <div className="flex items-center gap-3 border-t border-border-faint pt-4">
        {publishedAt ? (
          <>
            <span className="status-pill status-pill-on-track">Published</span>
            <form action={unpublishAction}>
              <input type="hidden" name="template_id" value={templateId} />
              <button type="submit" className="text-sm text-destructive hover:underline">
                Unpublish
              </button>
            </form>
          </>
        ) : (
          <form action={publishAction}>
            <input type="hidden" name="template_id" value={templateId} />
            <button
              type="submit"
              className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card"
            >
              Publish to trainees
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
