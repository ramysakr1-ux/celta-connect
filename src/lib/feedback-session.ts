/**
 * Is this timetable event the TP feedback session?
 *
 * Six places asked this question and three different ways: `title ===
 * "Feedback"` in the timetable, the trainee's rail and the assessor day, and
 * `title.toLowerCase().startsWith("feedback")` in the TP queue. On the demo
 * they agree, because every feedback row is titled exactly "Feedback". On a
 * centre that writes "Feedback — Group A" they would not: the TP tab would
 * show a feedback session while the Assessor tab warned that none was
 * timetabled on the visit day (walk, 23 Sep 2026).
 *
 * The rule is the looser of the two, which is a superset of the stricter one,
 * so nothing that matched before stops matching.
 *
 * It has to be `startsWith`, not `includes`. Two real titles show why:
 * "Giving feedback on tasks" is an INPUT SESSION about feedback, not a
 * feedback session, and "Written feedback only" is the last TP day's row,
 * which exists precisely to say there is no session to observe. Matching
 * either would tell an assessor they could watch feedback when they cannot --
 * the thing Handbook 14.2 requires them to do.
 *
 * Title matching is itself the weak part. The type column does not carry it
 * (both "Feedback" and "Written feedback only" are `supervised_session`), so
 * a dedicated type is the real answer, as migration 0296 did for the
 * unassessed teaching slot. Until then, at least every room asks the same
 * question.
 */
export function isFeedbackSession(title: string | null | undefined): boolean {
  return (title ?? "").toLowerCase().startsWith("feedback");
}
