"use client";

import { useActionState } from "react";
import { savePreCourseTaskResponses, type FormState } from "@/app/portfolio/[traineeId]/pre-course-task/actions";
import { MobileFormWizard, type WizardStep } from "@/components/mobile-form-wizard";
import { VoiceTextarea } from "@/components/voice-textarea";
import type { Database } from "@/lib/supabase/types";

type Section = Database["public"]["Tables"]["pre_course_task_sections"]["Row"];

const initialState: FormState = { error: null };

// Read-only (staff/isEditable=false) view is unchanged -- stacks every
// section, no wizard. A trainee actually filling this in gets the
// specs/build-spec.md §7 "one question per screen" treatment instead (see
// buildSteps below) -- each DB-driven section becomes its own step,
// grouped visually by its own accent/eyebrow rather than a shared
// SectionGroup wrapper, since MobileFormWizard needs one flat step list.
function SectionGroup({
  title,
  note,
  sections,
  responseTextBySection,
  isEditable,
  accentClass,
}: {
  title: string;
  note: string;
  sections: Section[];
  responseTextBySection: Record<string, string>;
  isEditable: boolean;
  accentClass: string;
}) {
  if (sections.length === 0) return null;
  return (
    <div className={`sheet flex flex-col gap-4 border-l-4 ${accentClass}`}>
      <div>
        <h3 className="font-serif text-lg text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">{note}</p>
      </div>
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1.5 border-t border-border-faint pt-4 first:border-none first:pt-0">
          <label className="text-sm font-medium text-ink">{section.title}</label>
          <p className="whitespace-pre-wrap text-sm text-muted">{section.prompt}</p>
          {isEditable ? (
            <>
              <input type="hidden" name="section_id" value={section.id} />
              <VoiceTextarea
                name={`response__${section.id}`}
                rows={4}
                defaultValue={responseTextBySection[section.id] ?? ""}
                className="mt-1 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </>
          ) : (
            <p className="mt-1 whitespace-pre-wrap rounded-[6px] border border-border-faint bg-accent/20 px-3 py-2 text-sm text-ink">
              {responseTextBySection[section.id] || <span className="text-muted">Not answered yet.</span>}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function buildSteps(
  groupLabel: string,
  accentClass: string,
  sections: Section[],
  responseTextBySection: Record<string, string>
): WizardStep[] {
  return sections.map((section) => ({
    key: section.id,
    content: (
      <div className={`sheet flex flex-col gap-1.5 border-l-4 ${accentClass}`}>
        <p className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">{groupLabel}</p>
        <label className="text-sm font-medium text-ink">{section.title}</label>
        <p className="whitespace-pre-wrap text-sm text-muted">{section.prompt}</p>
        <input type="hidden" name="section_id" value={section.id} />
        <VoiceTextarea
          name={`response__${section.id}`}
          rows={4}
          defaultValue={responseTextBySection[section.id] ?? ""}
          className="mt-1 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
    ),
  }));
}

export function PreCourseTaskForm({
  traineeId,
  cambridgeSections,
  supplementSections,
  responseTextBySection,
  isEditable,
}: {
  traineeId: string;
  cambridgeSections: Section[];
  supplementSections: Section[];
  responseTextBySection: Record<string, string>;
  isEditable: boolean;
}) {
  const [state, action, pending] = useActionState(savePreCourseTaskResponses, initialState);

  const groups = (
    <>
      <SectionGroup
        title="Cambridge's Pre-Course Task"
        note="© UCLES 2018 -- the official task, unchanged."
        sections={cambridgeSections}
        responseTextBySection={responseTextBySection}
        isEditable={isEditable}
        accentClass="border-l-primary"
      />
      <SectionGroup
        title="Your centre's supplement"
        note="Written by your centre, not by Cambridge -- covers teaching online and using L1, which the 2018 task predates."
        sections={supplementSections}
        responseTextBySection={responseTextBySection}
        isEditable={isEditable}
        accentClass="border-l-border"
      />
    </>
  );

  if (!isEditable) {
    return <div className="flex flex-col gap-4">{groups}</div>;
  }

  const steps: WizardStep[] = [
    ...buildSteps("Cambridge's Pre-Course Task", "border-l-primary", cambridgeSections, responseTextBySection),
    ...buildSteps("Your centre's supplement", "border-l-border", supplementSections, responseTextBySection),
  ];

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="trainee_id" value={traineeId} />
      <MobileFormWizard steps={steps} />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save answers"}
      </button>
    </form>
  );
}
