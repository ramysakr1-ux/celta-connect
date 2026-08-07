"use client";

import { useActionState, useMemo, useState } from "react";
import { saveAssignmentDraft, submitAssignment, type FormState } from "@/app/dashboard/trainee/assignments/[assignmentId]/actions";
import { FormSubmitBar } from "@/components/form-submit-bar";
import { VoiceTextarea } from "@/components/voice-textarea";
import { ASSIGNMENT_WORD_COUNT } from "@/lib/assignment-info";
import type { TemplateSection } from "@/lib/assignment-templates/content";

const initialState: FormState = { error: null };
const inputClass =
  "w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

interface SectionResponse {
  section_key: string;
  section_title: string;
  first_response: string | null;
  first_comments: string | null;
  resubmission_response: string | null;
  resubmission_comments: string | null;
}

export function AssignmentAuthoringForm({
  assignmentId,
  sections,
  responses,
  round,
  locked,
  deadlinePassed,
}: {
  assignmentId: string;
  sections: TemplateSection[];
  responses: SectionResponse[];
  round: "first" | "resubmission";
  locked: boolean;
  deadlinePassed: boolean;
}) {
  const responseByKey = new Map(responses.map((r) => [r.section_key, r]));
  const [mode, setMode] = useState<"focus" | "review">("focus");
  const [activeKey, setActiveKey] = useState<string>(sections[0]?.key ?? "");

  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of sections) {
      const existing = responseByKey.get(s.key);
      initial[s.key] = (round === "resubmission" ? existing?.resubmission_response : existing?.first_response) ?? "";
    }
    return initial;
  });

  const [draftState, draftAction, draftPending] = useActionState(saveAssignmentDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitAssignment, initialState);
  const state = submitPending ? submitState : draftState;

  const totalWords = useMemo(
    () => sections.reduce((sum, s) => sum + wordCount(texts[s.key] ?? ""), 0),
    [sections, texts]
  );
  const wordTone = totalWords < 750 ? "pending" : totalWords <= 1000 ? "on-track" : "at-risk";

  const sectionsPayload = sections.map((s) => ({ key: s.key, title: s.title, text: texts[s.key] ?? "" }));

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("focus")}
            className={`rounded-[6px] px-3 py-1.5 text-sm ${mode === "focus" ? "bg-primary text-card" : "text-muted hover:text-ink"}`}
          >
            Focus mode
          </button>
          <button
            type="button"
            onClick={() => setMode("review")}
            className={`rounded-[6px] px-3 py-1.5 text-sm ${mode === "review" ? "bg-primary text-card" : "text-muted hover:text-ink"}`}
          >
            Full review
          </button>
        </div>
        <span className={`status-pill status-pill-${wordTone}`}>
          {totalWords} words ({ASSIGNMENT_WORD_COUNT})
        </span>
      </div>

      {mode === "review" ? (
        <div className="card p-6">
          <h2 className="font-serif text-lg text-ink">Full review</h2>
          <p className="text-sm text-muted">Read-only -- switch to Focus mode to edit.</p>
          <div className="mt-4 flex flex-col gap-4">
            {sections.map((s) => (
              <div key={s.key}>
                <p className="text-sm text-muted">{s.title}</p>
                <p className="whitespace-pre-line text-ink">{texts[s.key] || "(empty)"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form action={draftAction} className="grid grid-cols-1 gap-4 lg:grid-cols-[248px_1fr] lg:items-start">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <input type="hidden" name="round" value={round} />
          <input type="hidden" name="sections_payload" value={JSON.stringify(sectionsPayload)} />

          <nav className="card flex flex-col gap-1 p-2 lg:sticky lg:top-6">
            {sections.map((s) => {
              const words = wordCount(texts[s.key] ?? "");
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveKey(s.key)}
                  className={`flex items-center justify-between gap-2 rounded-[6px] px-3 py-2 text-left text-sm transition-colors ${
                    activeKey === s.key ? "bg-accent font-medium text-ink" : "text-muted hover:bg-accent/50 hover:text-ink"
                  }`}
                >
                  <span>{s.title}</span>
                  <span className="shrink-0 text-xs text-muted">{words}w</span>
                </button>
              );
            })}
          </nav>

          <div className="flex flex-col gap-4">
            {sections
              .filter((s) => s.key === activeKey)
              .map((s) => {
                const existing = responseByKey.get(s.key);
                return (
                  <div key={s.key} className="card p-6">
                    <h3 className="font-serif text-lg text-ink">{s.title}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{s.instruction}</p>

                    {round === "resubmission" && existing?.first_response ? (
                      <div className="mt-3 rounded-[6px] border border-border-faint bg-background p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted">1st submission</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-muted">{existing.first_response}</p>
                        {existing.first_comments ? (
                          <div className="mt-2 border-t border-border-faint pt-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted">Tutor comment</p>
                            <p className="mt-1 whitespace-pre-line text-sm text-ink">{existing.first_comments}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3">
                      {locked ? (
                        <p className="whitespace-pre-line text-ink">{texts[s.key] || "(empty)"}</p>
                      ) : (
                        <VoiceTextarea
                          rows={12}
                          value={texts[s.key] ?? ""}
                          onChange={(e) => setTexts({ ...texts, [s.key]: e.target.value })}
                          className={inputClass}
                        />
                      )}
                    </div>
                    <p className="mt-1.5 text-right text-xs text-muted">{wordCount(texts[s.key] ?? "")} words</p>

                    {round === "first" && existing?.first_comments && locked ? (
                      <div className="mt-3 border-t border-border-faint pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-primary">Tutor comment</p>
                        <p className="mt-1 whitespace-pre-line text-ink">{existing.first_comments}</p>
                      </div>
                    ) : null}
                    {round === "resubmission" && existing?.resubmission_comments && locked ? (
                      <div className="mt-3 border-t border-border-faint pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-primary">Resubmission comment</p>
                        <p className="mt-1 whitespace-pre-line text-ink">{existing.resubmission_comments}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}

            {!locked ? (
              <FormSubmitBar
                warning="Submitting locks your responses until your tutor returns them."
                draftPending={draftPending}
                submitPending={submitPending}
                submitDisabled={deadlinePassed}
                onSubmitAction={submitActionFn}
                submitLabel={deadlinePassed ? "Deadline passed" : "Submit"}
                error={state.error}
              />
            ) : (
              <p className="text-sm text-muted">Submitted -- awaiting your tutor.</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
