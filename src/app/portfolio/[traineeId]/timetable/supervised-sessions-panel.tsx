import { checkSupervisedSession } from "@/app/portfolio/[traineeId]/supervised/[eventId]/actions";
import { SUPERVISED_QUIZ_TOPICS, type QuizTopicKey } from "@/lib/supervised-quiz-content";

interface SupervisedEventRow {
  id: string;
  title: string;
  event_date: string;
}

interface SupervisedCompletionRow {
  timetable_event_id: string;
  time_spent_seconds: number;
  response: string | null;
  submitted_at: string | null;
  checked_at: string | null;
  quiz_topic: QuizTopicKey | null;
  score: number | null;
  question_count: number | null;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// for-claude-code-supervised-review.md's "trainer visibility": a
// completion tick and time spent per session, plus the check-off step
// nothing wrote before checkSupervisedSession existed. Staff-only, on the
// same page the roster row's "N / total supervised" tooltip already
// points a trainer to ("click to see per-session status on their
// timetable").
export function SupervisedSessionsPanel({
  traineeId,
  events,
  completions,
}: {
  traineeId: string;
  events: SupervisedEventRow[];
  completions: SupervisedCompletionRow[];
}) {
  if (events.length === 0) return null;
  const completionByEventId = new Map(completions.map((c) => [c.timetable_event_id, c]));

  return (
    <div className="sheet flex flex-col gap-3">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Supervised review / writing</p>
      <div className="flex flex-col">
        {events.map((event, i) => {
          const completion = completionByEventId.get(event.id);
          const submitted = !!completion?.submitted_at;
          const checked = !!completion?.checked_at;
          return (
            <div
              key={event.id}
              className={`flex flex-col gap-2 py-3 ${i > 0 ? "border-t border-border-faint" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{event.title}</p>
                  <p className="text-xs text-muted">{event.event_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  {submitted && completion?.score != null && completion?.question_count != null ? (
                    <span className="text-xs font-semibold text-ink">
                      {SUPERVISED_QUIZ_TOPICS[completion.quiz_topic!]?.title ?? "Quiz"} — {completion.score}/{completion.question_count}
                    </span>
                  ) : null}
                  {submitted ? (
                    <span className="text-xs text-muted">{formatDuration(completion!.time_spent_seconds)} spent</span>
                  ) : null}
                  <span className={`pill ${submitted ? "pill-success" : "pill-warning"}`}>
                    {submitted ? "Submitted" : "Not submitted"}
                  </span>
                </div>
              </div>
              {submitted ? (
                <>
                  {completion?.response ? (
                    <p className="whitespace-pre-wrap rounded-[6px] bg-accent/40 p-2.5 text-sm text-ink">{completion.response}</p>
                  ) : null}
                  {checked ? (
                    <p className="text-xs text-primary">Checked</p>
                  ) : (
                    <form action={checkSupervisedSession}>
                      <input type="hidden" name="timetable_event_id" value={event.id} />
                      <input type="hidden" name="trainee_id" value={traineeId} />
                      <button
                        type="submit"
                        className="self-start rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-xs font-medium text-ink trainee-hover-fill"
                      >
                        Mark checked
                      </button>
                    </form>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
