"use client";

import { useActionState, useState } from "react";
import { submitApplication, type ApplyFormState } from "@/app/apply/actions";
import { AudioRecorder } from "@/components/audio-recorder";

interface Intake {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  deliveryMode: "f2f" | "online" | "mixed";
  availabilityLabel: string;
  full: boolean;
}

interface WritingPrompt {
  id: string;
  prompt_type: "narrative" | "descriptive" | "argumentative";
  prompt_text: string;
}

interface SpeakingPrompt {
  id: string;
  prompt_text: string;
}

const initialState: ApplyFormState = { error: null, submitted: false };

const inputClass =
  "rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary";

export function ApplicationForm({
  centerId,
  intakes,
  prompts,
  speakingPrompts,
}: {
  centerId: string;
  intakes: Intake[];
  prompts: WritingPrompt[];
  speakingPrompts: SpeakingPrompt[];
}) {
  const [state, action, pending] = useActionState(submitApplication, initialState);
  const [selectedIntakeId, setSelectedIntakeId] = useState(intakes[0]?.id ?? "");
  const [selectedPromptId, setSelectedPromptId] = useState(prompts[0]?.id ?? "");
  const [selectedSpeakingPromptId, setSelectedSpeakingPromptId] = useState(speakingPrompts[0]?.id ?? "");
  const selectedIntake = intakes.find((i) => i.id === selectedIntakeId);

  if (state.submitted) {
    return (
      <div className="py-8 text-center">
        <p className="font-serif text-lg text-ink">Thank you for applying.</p>
        <p className="mt-2 text-sm text-muted">
          We&apos;ve received your application. We&apos;ll be in touch by email with next steps.
        </p>
      </div>
    );
  }

  if (intakes.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">There are no open intakes accepting applications right now.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="center_id" value={centerId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="intake_course_id" className="text-sm text-muted">
          Which course are you applying for?
        </label>
        <select
          id="intake_course_id"
          name="intake_course_id"
          required
          value={selectedIntakeId}
          onChange={(e) => setSelectedIntakeId(e.target.value)}
          className={inputClass}
        >
          {intakes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.startDate} - {i.endDate}) -- {i.availabilityLabel}
            </option>
          ))}
        </select>
        {selectedIntake?.full ? (
          <p className="text-xs text-muted">
            This intake is full. You can still apply -- you&apos;ll be added to the waiting list.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="full_name" className="text-sm text-muted">
            Full name
          </label>
          <input id="full_name" name="full_name" type="text" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm text-muted">
            Email
          </label>
          <input id="email" name="email" type="email" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm text-muted">
            Phone (optional)
          </label>
          <input id="phone" name="phone" type="tel" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date_of_birth" className="text-sm text-muted">
            Date of birth
          </label>
          <input id="date_of_birth" name="date_of_birth" type="date" required className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="education_summary" className="text-sm text-muted">
          Your education (equivalent to entry into higher education)
        </label>
        <textarea id="education_summary" name="education_summary" rows={2} required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="elt_experience_summary" className="text-sm text-muted">
          Any English language teaching experience? (little or none is fine -- CELTA is an introductory course)
        </label>
        <textarea id="elt_experience_summary" name="elt_experience_summary" rows={2} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="special_requirements" className="text-sm text-muted">
          Any special requirements we should arrange for? (optional)
        </label>
        <textarea id="special_requirements" name="special_requirements" rows={2} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cannot_attend_note" className="text-sm text-muted">
          Is there any part of the course you would not be able to attend? (optional)
        </label>
        <textarea id="cannot_attend_note" name="cannot_attend_note" rows={2} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="anything_else" className="text-sm text-muted">
          Anything else we should know? (optional)
        </label>
        <textarea id="anything_else" name="anything_else" rows={2} className={inputClass} />
      </div>

      {prompts.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-semibold text-ink">Extended writing task</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="writing_task_prompt_id" className="text-sm text-muted">
              Choose one prompt
            </label>
            <select
              id="writing_task_prompt_id"
              name="writing_task_prompt_id"
              required
              value={selectedPromptId}
              onChange={(e) => setSelectedPromptId(e.target.value)}
              className={inputClass}
            >
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prompt_type[0].toUpperCase() + p.prompt_type.slice(1)}: {p.prompt_text}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="writing_task_submission" className="text-sm text-muted">
              Your response
            </label>
            <textarea id="writing_task_submission" name="writing_task_submission" rows={8} required className={inputClass} />
          </div>
        </div>
      ) : null}

      {speakingPrompts.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-semibold text-ink">Speaking task</p>
          <p className="text-xs text-muted">
            This isn&apos;t an interview -- there&apos;s no follow-up, no conversation. Pick a prompt, record your
            response, and submit. It&apos;s reviewed by a person ahead of your real interview.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="speaking_task_prompt_id" className="text-sm text-muted">
              Choose one prompt
            </label>
            <select
              id="speaking_task_prompt_id"
              name="speaking_task_prompt_id"
              required
              value={selectedSpeakingPromptId}
              onChange={(e) => setSelectedSpeakingPromptId(e.target.value)}
              className={inputClass}
            >
              {speakingPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prompt_text}
                </option>
              ))}
            </select>
          </div>
          <AudioRecorder name="speaking_task_audio" required />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <p className="text-sm font-semibold text-ink">Language awareness</p>
        <label htmlFor="language_awareness_answer" className="text-sm text-muted">
          Identify and correct any language errors you notice in this passage: &ldquo;She has been living here since three
          years and she don&apos;t like the winter, but her job make her stay.&rdquo;
        </label>
        <textarea id="language_awareness_answer" name="language_awareness_answer" rows={3} required className={inputClass} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-ink">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="ack_no_guarantee" required className="mt-0.5" />
          I understand that completing the course does not guarantee success.
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="ack_no_exemptions" required className="mt-0.5" />
          I understand there are no exemptions or recognition of prior learning.
        </label>
        {selectedIntake?.deliveryMode === "mixed" ? (
          <label className="flex items-start gap-2">
            <input type="checkbox" name="ack_mixed_mode" required className="mt-0.5" />
            I understand this course involves teaching practice in both face-to-face and online modes.
          </label>
        ) : null}
        <label className="flex items-start gap-2">
          <input type="checkbox" name="ack_writing_task" required className="mt-0.5" />
          I confirm the writing, speaking and language awareness responses above are my own work.
        </label>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
