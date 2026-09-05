"use client";

import { useActionState, useState } from "react";
import {
  returnAsFail,
  returnForResubmission,
  returnWithPass,
  type FormState,
} from "@/app/dashboard/trainer/trainees/[id]/assignments/[assignmentId]/actions";
import { TrainerFeedbackTextarea } from "@/components/trainer-feedback-textarea";
import type { AssignmentCriterion, CriteriaMarks } from "@/lib/assignment-criteria";
import type { AssignmentTypeValue, TemplateSection } from "@/lib/assignment-templates/content";

const initialState: FormState = { error: null };
const inputClass =
  "w-full rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary";

type Outcome = "pass" | "resub" | "fail";

interface SectionResponse {
  section_key: string;
  section_title: string;
  first_response: string | null;
  first_comments: string | null;
  resubmission_response: string | null;
  resubmission_comments: string | null;
}

export function AssignmentReviewForm({
  assignmentId,
  assignmentType,
  sections,
  responses,
  round,
  criteriaMarks,
  criteria,
  secondMarkerOptions,
}: {
  assignmentId: string;
  assignmentType: AssignmentTypeValue;
  sections: TemplateSection[];
  responses: SectionResponse[];
  round: "first" | "resubmission";
  criteriaMarks: CriteriaMarks;
  criteria: AssignmentCriterion[];
  secondMarkerOptions: { id: string; full_name: string }[];
}) {
  const responseByKey = new Map(responses.map((r) => [r.section_key, r]));
  const isResubmission = round === "resubmission";
  // build-spec.md "Assignment 5": one chance, pass or fail -- no
  // resubmission round for this type, so a fail is available immediately
  // instead of gated behind a resubmission round that will never happen.
  const isOneChanceReflection = assignmentType === "Plagiarism Reflection";
  const canFail = isResubmission || isOneChanceReflection;

  const [marks, setMarks] = useState<CriteriaMarks>(criteriaMarks);
  const [outcome, setOutcome] = useState<Outcome>("pass");
  const [secondMarkerId, setSecondMarkerId] = useState("");

  const [passState, passAction, passPending] = useActionState(returnWithPass, initialState);
  const [resubState, resubAction, resubPending] = useActionState(returnForResubmission, initialState);
  const [failState, failAction, failPending] = useActionState(returnAsFail, initialState);
  const pending = passPending || resubPending || failPending;
  const state = passPending ? passState : resubPending ? resubState : failState;

  const submitAction = outcome === "pass" ? passAction : outcome === "resub" ? resubAction : failAction;
  const submitDisabled = isResubmission && !secondMarkerId;

  const cta = outcome === "pass" ? "Return with a pass" : outcome === "resub" ? "Return for resubmission" : "Record a fail";
  const ctaNote = submitDisabled
    ? "Pick a second marker before returning a resubmission decision."
    : outcome === "pass"
      ? "Releases your comments and the grade note to the trainee."
      : outcome === "resub"
        ? "The trainee gets one rewrite. Sections you did not comment on carry over untouched."
        : "This assignment is graded Fail on resubmission -- it cannot be reopened.";

  return (
    <form className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="round" value={round} />
      <input
        type="hidden"
        name="section_keys"
        value={JSON.stringify(sections.map((s) => ({ key: s.key, title: s.title })))}
      />
      <input type="hidden" name="criteria_marks" value={JSON.stringify(marks)} />
      <input type="hidden" name="second_marker_id" value={secondMarkerId} />

      <div className="flex flex-col gap-4">
        {sections.map((s) => {
          const existing = responseByKey.get(s.key);
          const responseText = (isResubmission ? existing?.resubmission_response : existing?.first_response) ?? "";
          const existingComment = (isResubmission ? existing?.resubmission_comments : existing?.first_comments) ?? "";
          return (
            <div key={s.key} className="card p-6">
              <h3 className="font-serif text-lg text-ink">{s.title}</h3>
              <p className="mt-3 whitespace-pre-line text-ink">{responseText || "(no response)"}</p>
              <div className="mt-4 flex flex-col gap-1.5 border-t border-border-faint pt-4">
                <label className="text-sm text-muted">Comment on this section</label>
                <TrainerFeedbackTextarea
                  name={`comment_${s.key}`}
                  rows={3}
                  defaultValue={existingComment}
                  className={inputClass}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {/* specs/build-spec.md §7 "Laptop only: marking against criteria" --
            hidden, not removed: the underlying inputs still submit with the
            form either way (a hidden field's value isn't dropped from
            FormData), this just keeps the cramped checklist off a phone. */}
        <div className="card hidden flex-col gap-3 p-5 md:flex">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Assessment criteria · {isResubmission ? "resubmission" : "1st submission"}
            </p>
            <a
              href={`/trainer/marking-guidance?type=${encodeURIComponent(assignmentType)}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[11px] font-medium text-primary hover:underline"
            >
              Marking guidance →
            </a>
          </div>
          <div className="flex flex-col">
            {criteria.map((c) => {
              const met = marks[c.key] === true;
              return (
                <div key={c.key} className="flex items-center justify-between gap-3 border-b border-border-faint py-2 last:border-none">
                  <span className="text-xs text-ink">{c.text}</span>
                  <button
                    type="button"
                    onClick={() => setMarks((m) => ({ ...m, [c.key]: !met }))}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      met ? "bg-status-neutral-bg text-ink" : "bg-status-warning-bg text-status-warning-text"
                    }`}
                  >
                    {met ? "Met" : "Not met"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] italic text-muted">
            Any criterion Not met on the first submission means Resubmission Needed. These are what the cover sheet prints.
          </p>
        </div>
        <div className="card p-5 text-sm text-muted md:hidden">
          Assessment criteria needs more room than a phone screen -- open this assignment on a laptop or tablet to mark it.
        </div>

        <div className="card flex flex-col gap-3 p-5">
          <h3 className="font-serif text-lg text-ink">Return this assignment</h3>
          <div className="flex flex-col gap-2">
            <OutcomeOption
              label="Return with a pass"
              note="Marks this round approved. The trainee sees your comments and the grade note."
              selected={outcome === "pass"}
              onSelect={() => setOutcome("pass")}
            />
            {isOneChanceReflection ? null : (
              <OutcomeOption
                label="Return for resubmission"
                note="Opens one resubmission -- the only one allowed. Your comments carry across beside the original."
                selected={outcome === "resub"}
                onSelect={() => setOutcome("resub")}
              />
            )}
            <OutcomeOption
              label="Record a fail"
              note={
                isOneChanceReflection
                  ? "One chance only -- a fail here is final."
                  : isResubmission
                    ? "Only after a resubmission. Still unsatisfactory at this point -- the assignment is graded Fail and cannot be reopened."
                    : "Only available once this assignment is on its resubmission round."
              }
              selected={outcome === "fail"}
              onSelect={() => canFail && setOutcome("fail")}
              disabled={!canFail}
            />
          </div>

          {isResubmission ? (
            <div className="flex flex-col gap-1.5 border-t border-border-faint pt-3">
              <label className="text-sm text-muted">Second marker</label>
              <select
                value={secondMarkerId}
                onChange={(e) => setSecondMarkerId(e.target.value)}
                className={inputClass}
              >
                <option value="">— choose —</option>
                {secondMarkerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] italic text-muted">Required whenever a resubmission is returned, pass or fail.</p>
            </div>
          ) : null}

          {outcome === "pass" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-muted">Final grade note</label>
              <input type="text" name="final_grade" placeholder="e.g. Pass" className={inputClass} />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border-faint pt-3">
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <button
              type="submit"
              formAction={submitAction}
              disabled={pending || submitDisabled}
              className={`rounded-[6px] px-4 py-2 text-sm font-medium text-card disabled:opacity-60 ${
                outcome === "fail" ? "bg-destructive" : "bg-primary"
              }`}
            >
              {pending ? "Returning…" : cta}
            </button>
            <p className="text-xs text-muted">{ctaNote}</p>
          </div>
        </div>
      </div>
    </form>
  );
}

function OutcomeOption({
  label,
  note,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  note: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex flex-col gap-1 rounded-[6px] border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-primary bg-accent/30" : "border-border hover:border-primary/50"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`size-3 shrink-0 rounded-full border ${selected ? "border-primary bg-primary" : "border-border"}`} />
        <span className="text-sm font-semibold text-ink">{label}</span>
      </span>
      <span className="pl-5 text-xs text-muted">{note}</span>
    </button>
  );
}
