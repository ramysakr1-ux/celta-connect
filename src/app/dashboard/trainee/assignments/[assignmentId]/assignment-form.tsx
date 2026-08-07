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
  const isResubmission = round === "resubmission";
  const [mode, setMode] = useState<"focus" | "review">("focus");
  const [activeKey, setActiveKey] = useState<string>(sections[0]?.key ?? "");

  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of sections) {
      const existing = responseByKey.get(s.key);
      initial[s.key] = (isResubmission ? existing?.resubmission_response : existing?.first_response) ?? "";
    }
    return initial;
  });

  const [draftState, draftAction, draftPending] = useActionState(saveAssignmentDraft, initialState);
  const [submitState, submitActionFn, submitPending] = useActionState(submitAssignment, initialState);
  const state = submitPending ? submitState : draftState;

  const [aiDeclared, setAiDeclared] = useState(false);
  const [aiConversationUrl, setAiConversationUrl] = useState("");

  const totalWords = useMemo(
    () => sections.reduce((sum, s) => sum + wordCount(texts[s.key] ?? ""), 0),
    [sections, texts]
  );
  const wordTone = totalWords < 750 ? "pending" : totalWords <= 1000 ? "on-track" : "at-risk";
  const wordCountOutOfRange = totalWords < 750 || totalWords > 1000;
  const aiDeclarationIncomplete = aiDeclared && !aiConversationUrl.trim();

  const blockReasons: string[] = [];
  if (wordCountOutOfRange) blockReasons.push(`word count must be 750-1,000 (currently ${totalWords})`);
  if (aiDeclarationIncomplete) blockReasons.push("add the AI conversation link below before submitting");
  const submitDisabled = blockReasons.length > 0;
  // A late submission is allowed, not blocked -- it's recorded as late and
  // the tutor decides what to do about it, rather than the candidate being
  // unable to submit at all and the conversation happening offline with no
  // record (specs/for-claude-code.md).
  const submitWarning = submitDisabled
    ? `Can't submit yet -- ${blockReasons.join("; ")}.`
    : deadlinePassed
      ? "This assignment is past its deadline -- submitting now will be recorded as late."
      : "Submitting locks your responses until your tutor returns them.";

  const sectionsPayload = sections.map((s) => ({ key: s.key, title: s.title, text: texts[s.key] ?? "" }));

  const hiddenFields = (
    <>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="sections_payload" value={JSON.stringify(sectionsPayload)} />
      <input type="hidden" name="ai_declared" value={aiDeclared ? "true" : "false"} />
      <input type="hidden" name="ai_conversation_url" value={aiConversationUrl} />
    </>
  );

  const aiDeclarationBlock = (
    <div className="card flex flex-col gap-2 p-4">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={aiDeclared} onChange={(e) => setAiDeclared(e.target.checked)} />
        Did you use any AI tool, including a proofreader such as Grammarly?
      </label>
      {aiDeclared ? (
        <div className="mt-1 flex flex-col gap-1">
          <label className="text-xs text-muted">AI conversation link</label>
          <input
            type="url"
            value={aiConversationUrl}
            onChange={(e) => setAiConversationUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-4">
        {isResubmission ? (
          <p className="text-sm font-medium text-ink">Resubmission -- one opportunity only</p>
        ) : (
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
        )}
        <span className={`status-pill status-pill-${wordTone}`}>
          {totalWords} words ({ASSIGNMENT_WORD_COUNT})
        </span>
      </div>

      {isResubmission ? (
        <>
          {!locked ? (
            <div className="flex items-start gap-3 rounded-[6px] border border-gold/40 bg-gold/10 p-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold" />
              <p className="text-sm text-ink">
                Use the boxes on the right for your second submission -- the boxes on the left and your tutor&apos;s comments stay
                exactly as they were. Whether you pass on first or second submission does not affect your certificate grade, but you
                must pass 3 out of 4 assignments to be eligible for a PASS.
              </p>
            </div>
          ) : null}

          <form action={draftAction} className="flex flex-col gap-4">
            {hiddenFields}
            {sections.map((s) => {
              const existing = responseByKey.get(s.key);
              const carriedOver = !existing?.first_comments;
              return (
                <div key={s.key} className="card flex flex-col gap-3 p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-lg text-ink">{s.title}</h3>
                    {carriedOver ? (
                      <span className="status-pill status-pill-on-track">Carried over</span>
                    ) : (
                      <span className="status-pill status-pill-at-risk">Needs rewriting</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">1st submission</p>
                      <p className="min-h-[84px] rounded-[6px] border border-border-faint bg-background p-3 text-sm whitespace-pre-line text-muted">
                        {existing?.first_response || "(no response)"}
                      </p>
                      {existing?.first_comments ? (
                        <div className="rounded-[6px] border border-primary/20 bg-accent/20 p-2.5">
                          <p className="text-[10px] font-semibold tracking-[0.08em] text-primary uppercase">Tutor comment · read-only</p>
                          <p className="mt-1 text-sm text-ink">{existing.first_comments}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] font-semibold tracking-[0.1em] text-primary uppercase">Your resubmission</p>
                        <span className="text-xs text-muted">{wordCount(texts[s.key] ?? "")} words</span>
                      </div>
                      {locked ? (
                        <p className="whitespace-pre-line text-ink">{texts[s.key] || "(empty)"}</p>
                      ) : (
                        <VoiceTextarea
                          rows={6}
                          value={texts[s.key] ?? ""}
                          onChange={(e) => setTexts({ ...texts, [s.key]: e.target.value })}
                          className={inputClass}
                        />
                      )}
                      {locked && existing?.resubmission_comments ? (
                        <div className="mt-1 border-t border-border-faint pt-2">
                          <p className="text-[10px] font-semibold tracking-[0.08em] text-primary uppercase">Resubmission comment</p>
                          <p className="mt-1 text-sm text-ink">{existing.resubmission_comments}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {!locked ? (
              <>
                {aiDeclarationBlock}
                <FormSubmitBar
                  warning={submitWarning}
                  draftPending={draftPending}
                  submitPending={submitPending}
                  submitDisabled={submitDisabled}
                  onSubmitAction={submitActionFn}
                  submitLabel={deadlinePassed ? "Submit (late)" : "Submit resubmission"}
                  error={state.error}
                />
              </>
            ) : (
              <p className="text-sm text-muted">Submitted -- awaiting your tutor.</p>
            )}
          </form>
        </>
      ) : mode === "review" ? (
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
          {hiddenFields}

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

                    {existing?.first_comments && locked ? (
                      <div className="mt-3 border-t border-border-faint pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-primary">Tutor comment</p>
                        <p className="mt-1 whitespace-pre-line text-ink">{existing.first_comments}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}

            {!locked ? (
              <>
                {aiDeclarationBlock}
                <FormSubmitBar
                  warning={submitWarning}
                  draftPending={draftPending}
                  submitPending={submitPending}
                  submitDisabled={submitDisabled}
                  onSubmitAction={submitActionFn}
                  submitLabel={deadlinePassed ? "Submit (late)" : "Submit"}
                  error={state.error}
                />
              </>
            ) : (
              <p className="text-sm text-muted">Submitted -- awaiting your tutor.</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
