"use client";

import { useActionState } from "react";
import {
  addCriteriaTag,
  removeCriteriaTag,
  type FormState,
} from "@/app/dashboard/trainer/actions";
import { CELTA_CRITERIA_CODES } from "@/lib/celta-criteria";
import type { Database } from "@/lib/supabase/types";

type Tag = Database["public"]["Tables"]["tp_lesson_criteria_tags"]["Row"];

const initialState: FormState = { error: null };

function RemoveTagButton({ tagId, traineeId }: { tagId: string; traineeId: string }) {
  const [, action] = useActionState(removeCriteriaTag, initialState);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="tag_id" value={tagId} />
      <input type="hidden" name="trainee_id" value={traineeId} />
      <button type="submit" className="ml-1 text-muted hover:text-destructive" aria-label="Remove tag">
        &times;
      </button>
    </form>
  );
}

export function CriteriaTagsEditor({
  lessonId,
  traineeId,
  tags,
}: {
  lessonId: string;
  traineeId: string;
  tags: Tag[];
}) {
  const [state, action, pending] = useActionState(addCriteriaTag, initialState);

  return (
    <div className="border-t border-border-faint pt-3">
      <p className="text-xs text-muted">Criteria tags</p>
      {tags.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t.id}
              className={`status-pill ${
                t.tag_type === "strength" ? "status-pill-on-track" : "status-pill-at-risk"
              }`}
            >
              {t.criteria_code} {t.tag_type === "strength" ? "strength" : "action point"}
              <RemoveTagButton tagId={t.id} traineeId={traineeId} />
            </span>
          ))}
        </div>
      ) : null}

      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="lesson_id" value={lessonId} />
        <input type="hidden" name="trainee_id" value={traineeId} />
        <select
          name="criteria_code"
          required
          defaultValue=""
          className="rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
        >
          <option value="" disabled>
            Criterion
          </option>
          {CELTA_CRITERIA_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <select
          name="tag_type"
          defaultValue="strength"
          className="rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
        >
          <option value="strength">Strength</option>
          <option value="action_point">Action point</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[6px] border border-border px-2 py-1 text-xs text-ink hover:border-primary disabled:opacity-60"
        >
          {pending ? "Adding..." : "Add tag"}
        </button>
      </form>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </div>
  );
}
