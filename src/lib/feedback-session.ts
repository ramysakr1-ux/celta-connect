/**
 * Is this timetable row the TP feedback session?
 *
 * It reads the row's TYPE. Migration 0311 gave the feedback session its own
 * type, for the same reason 0296 gave one to the unassessed teaching slot: a
 * kind of session is not a word in a title.
 *
 * What this replaced, and why the title could never answer it. Three shapes
 * all meant "feedback session" -- `Feedback / Self-evaluations lead`,
 * `Feedback / Written feedback only` from the generator, and
 * `Written feedback only / Final TP, no live session` from the seed -- while
 * `Giving feedback on tasks` is an INPUT session about feedback and must not
 * match. Any `includes('feedback')` caught the input session; `startsWith`
 * avoided that but missed the third shape. Six call sites had settled on three
 * different tests between them (8453fdf0 made them agree; it could not make
 * them right).
 */
export function isFeedbackSession(event: { type?: string | null }): boolean {
  return event.type === "feedback";
}

/**
 * ...and is it written-only, with no live session to attend?
 *
 * Kept separate from the type on purpose. A written-only day IS still the
 * feedback session -- the candidate has to see it on their day -- but there is
 * nothing for an assessor to observe, which Handbook 14.2 requires of them:
 * "The assessor then observes the feedback."
 *
 * So the two questions have two answers. `isFeedbackSession` asks whether the
 * session exists; this asks whether anyone can sit in it.
 */
export function isWrittenFeedbackOnly(event: { type?: string | null; feedback_written_only?: boolean | null }): boolean {
  return isFeedbackSession(event) && event.feedback_written_only === true;
}

/** A feedback session someone can actually attend or observe. */
export function isObservableFeedbackSession(event: {
  type?: string | null;
  feedback_written_only?: boolean | null;
}): boolean {
  return isFeedbackSession(event) && !isWrittenFeedbackOnly(event);
}
