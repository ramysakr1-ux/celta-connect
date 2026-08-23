"use client";

// The two sentences build-spec.md says only a person can write: "what would
// have made the difference, and what happens next". Both textareas are
// controlled here (not the app's usual TrainerFeedbackTextarea, which is
// ref-based/uncontrolled -- these values need to be mirrored as hidden
// inputs into TWO separate forms below, one per action) so both the "Save
// draft" and "File this reply" buttons always submit the latest typed text,
// whichever one is clicked.
//
// Saving a draft and filing are deliberately two different actions, not one
// form with a checkbox -- "generated but never sent automatically; the
// tutor edits it and effectively signs it by choosing to release/file it."
// Filing is the one irreversible-feeling step, so it gets its own explicit
// button and its own validation (both paragraphs required).

import { useActionState, useState } from "react";
import {
  updateGradeQueryReplyDraft,
  fileGradeQueryReply,
  type FormState,
} from "@/app/trainer/(hub)/grade-query-reply/actions";

const initialState: FormState = { error: null };

export function ReplyEditor({
  replyId,
  traineeId,
  initialWhatWouldHaveMadeTheDifference,
  initialWhatHappensNext,
}: {
  replyId: string;
  traineeId: string;
  initialWhatWouldHaveMadeTheDifference: string;
  initialWhatHappensNext: string;
}) {
  const [whatWould, setWhatWould] = useState(initialWhatWouldHaveMadeTheDifference);
  const [whatNext, setWhatNext] = useState(initialWhatHappensNext);
  const [draftState, draftAction, draftPending] = useActionState(updateGradeQueryReplyDraft, initialState);
  const [fileState, fileAction, filePending] = useActionState(fileGradeQueryReply, initialState);

  return (
    <div className="sheet flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">Write yourself: the two sentences the record can&apos;t give you</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">What would have made the difference</label>
        <textarea
          value={whatWould}
          onChange={(e) => setWhatWould(e.target.value)}
          rows={4}
          placeholder="e.g. Consistent S+ across TP6-8 rather than TP7-8 only would have supported Pass B..."
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted">What happens next if they&apos;re still unsatisfied</label>
        <textarea
          value={whatNext}
          onChange={(e) => setWhatNext(e.target.value)}
          rows={4}
          placeholder="e.g. The centre's Internal Complaints Procedure (Handbook 15), and then Cambridge Appeal Stage One..."
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={draftAction}>
          <input type="hidden" name="reply_id" value={replyId} />
          <input type="hidden" name="trainee_id" value={traineeId} />
          <input type="hidden" name="what_would_have_made_the_difference" value={whatWould} />
          <input type="hidden" name="what_happens_next" value={whatNext} />
          <button
            type="submit"
            disabled={draftPending}
            className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink trainer-hover disabled:opacity-60"
          >
            {draftPending ? "Saving..." : "Save draft"}
          </button>
        </form>

        <form action={fileAction}>
          <input type="hidden" name="reply_id" value={replyId} />
          <input type="hidden" name="trainee_id" value={traineeId} />
          <input type="hidden" name="what_would_have_made_the_difference" value={whatWould} />
          <input type="hidden" name="what_happens_next" value={whatNext} />
          <button
            type="submit"
            disabled={filePending}
            className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
          >
            {filePending ? "Filing..." : "File this reply"}
          </button>
        </form>
      </div>

      {draftState.error ? <p className="text-sm text-destructive">{draftState.error}</p> : null}
      {fileState.error ? <p className="text-sm text-destructive">{fileState.error}</p> : null}

      <p className="text-xs text-muted">
        Filing does not send anything -- Connect never emails the candidate automatically. Filing marks this as
        the record of what you sent, once you&apos;ve copied it out yourself.
      </p>
    </div>
  );
}
