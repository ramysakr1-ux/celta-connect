"use client";

import { useEffect, useRef, useState } from "react";
import { heartbeatSupervisedSession, submitSupervisedQuiz } from "@/app/portfolio/[traineeId]/supervised/[eventId]/actions";
import {
  QUIZ_SECONDS,
  SUPERVISED_QUIZ_TOPIC_LIST,
  SUPERVISED_QUIZ_TOPICS,
  type QuizTopicKey,
} from "@/lib/supervised-quiz-content";
import type { Database } from "@/lib/supabase/types";

type Completion = Database["public"]["Tables"]["supervised_session_completions"]["Row"];

const HEARTBEAT_SECONDS = 15;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function resultNote(score: number, questionCount: number): string {
  return score >= questionCount * 0.7 ? "Solid — the review stuck." : "Worth another look at the notes before your next TP.";
}

type Stage = "pick" | "notes" | "quiz" | "result";

// specs/handoffs/Supervised Review Quiz.dc.html -- resolves migration
// 0100's own flagged open question ("reread-only vs reread+quiz isn't
// resolved yet"): reread (topic notes), then a timed, auto-scored quiz.
export function SupervisedTaskForm({ eventId, completion }: { eventId: string; completion: Completion | null }) {
  const [liveSeconds, setLiveSeconds] = useState(completion?.time_spent_seconds ?? 0);
  const pendingDelta = useRef(0);
  const locked = Boolean(completion?.submitted_at);

  useEffect(() => {
    if (locked) return;
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setLiveSeconds((s) => s + 1);
      pendingDelta.current += 1;
    }, 1000);
    const heartbeat = setInterval(() => {
      if (pendingDelta.current <= 0) return;
      const delta = pendingDelta.current;
      pendingDelta.current = 0;
      heartbeatSupervisedSession(eventId, delta);
    }, HEARTBEAT_SECONDS * 1000);
    function flushOnHide() {
      if (document.visibilityState === "hidden" && pendingDelta.current > 0) {
        const delta = pendingDelta.current;
        pendingDelta.current = 0;
        heartbeatSupervisedSession(eventId, delta);
      }
    }
    document.addEventListener("visibilitychange", flushOnHide);
    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", flushOnHide);
      if (pendingDelta.current > 0) heartbeatSupervisedSession(eventId, pendingDelta.current);
    };
  }, [eventId, locked]);

  const [stage, setStage] = useState<Stage>("pick");
  const [topicKey, setTopicKey] = useState<QuizTopicKey | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; questionCount: number } | null>(null);

  const topic = topicKey ? SUPERVISED_QUIZ_TOPICS[topicKey] : null;

  async function doSubmit(finalAnswers: (number | null)[]) {
    if (!topicKey || submitting) return;
    setSubmitting(true);
    const res = await submitSupervisedQuiz(eventId, topicKey, finalAnswers);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult({ score: res.score!, questionCount: res.questionCount! });
    setStage("result");
  }

  // 12-minute countdown, only while the quiz stage is live -- force-submits
  // whatever's answered so far at zero, same as the handoff's own timer.
  useEffect(() => {
    if (stage !== "quiz") return;
    if (secondsLeft <= 0) {
      doSubmit(answers);
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, secondsLeft]);

  if (locked) {
    // A pre-migration completion (free-text response, no score) still
    // needs to render something -- the old submitted view, unchanged.
    if (completion?.score == null || completion?.question_count == null) {
      return (
        <div className="sheet flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Submitted</p>
            <p className="text-xs text-muted">Time spent: {formatDuration(completion!.time_spent_seconds)}</p>
          </div>
          {completion?.response ? <p className="whitespace-pre-wrap text-sm text-ink">{completion.response}</p> : null}
          {completion?.checked_at ? (
            <p className="text-xs text-primary">Checked by your trainer.</p>
          ) : (
            <p className="text-xs text-muted">Waiting on your trainer to check this.</p>
          )}
        </div>
      );
    }
    return (
      <div className="sheet flex flex-col items-center gap-2 py-2 text-center">
        <p className="font-serif text-2xl text-ink">
          {completion.score} / {completion.question_count}
        </p>
        <p className="text-sm text-muted">{resultNote(completion.score, completion.question_count)}</p>
        <p className="mt-1.5 text-xs text-muted">
          Submitted · time spent {formatDuration(completion.time_spent_seconds)} · your tutor can see this
        </p>
        {completion.checked_at ? (
          <p className="mt-2 text-xs text-primary">Checked by your trainer.</p>
        ) : (
          <p className="mt-2 text-xs text-muted">Waiting on your trainer to check this.</p>
        )}
      </div>
    );
  }

  if (stage === "result" && result) {
    return (
      <div className="sheet flex flex-col items-center gap-2 py-2 text-center">
        <p className="font-serif text-2xl text-ink">
          {result.score} / {result.questionCount}
        </p>
        <p className="text-sm text-muted">{resultNote(result.score, result.questionCount)}</p>
        <p className="mt-1.5 text-xs text-muted">
          Submitted · time spent {formatDuration(liveSeconds)} · your tutor can see this
        </p>
        <p className="mt-2 text-xs text-muted">Waiting on your trainer to check this.</p>
      </div>
    );
  }

  if (stage === "quiz" && topic) {
    const question = topic.questions[qIndex];
    const answered = answers[qIndex];
    const isLast = qIndex + 1 === topic.questions.length;
    return (
      <div className="sheet flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg text-ink">{topic.title} quiz</h2>
          <span className={`text-sm font-bold tabular-nums ${secondsLeft < 60 ? "text-destructive" : "text-muted"}`}>
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
          </span>
        </div>
        <p className="text-xs text-muted">
          Question {qIndex + 1} of {topic.questions.length}
        </p>
        <div className="flex flex-col gap-3.5 rounded-[8px] border border-border bg-card p-5">
          <p className="text-sm font-semibold leading-snug text-ink">{question.text}</p>
          <div className="flex flex-col gap-2">
            {question.opts.map((opt, i) => {
              const isAnswered = answered !== null && answered !== undefined;
              let cls = "border-border bg-card text-ink hover:border-primary";
              if (isAnswered) {
                if (i === question.correct) cls = "border-primary bg-primary/10 text-primary";
                else if (i === answered) cls = "border-destructive bg-destructive/10 text-destructive";
                else cls = "border-border bg-card text-muted";
              }
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isAnswered}
                  onClick={() =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[qIndex] = i;
                      return next;
                    })
                  }
                  className={`rounded-[6px] border px-3.5 py-2.5 text-left text-sm ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={answered === null || answered === undefined || submitting}
            onClick={() => (isLast ? doSubmit(answers) : setQIndex((i) => i + 1))}
            className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {isLast ? (submitting ? "Submitting…" : "Submit") : "Next question"}
          </button>
        </div>
      </div>
    );
  }

  if (stage === "notes" && topic) {
    return (
      <div className="sheet flex flex-col gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{topic.title} · review notes</p>
          <h2 className="mt-1 font-serif text-lg text-ink">Recap before the quiz</h2>
        </div>
        <div className="flex flex-col gap-2.5">
          {topic.notes.map((n, i) => (
            <div key={i} className="rounded-[8px] border border-border bg-card px-3.5 py-3">
              <p className="text-sm font-semibold text-ink">{n.h}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.b}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setAnswers(new Array(topic.questions.length).fill(null));
            setQIndex(0);
            setSecondsLeft(QUIZ_SECONDS);
            setStage("quiz");
          }}
          className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Start the quiz — {QUIZ_SECONDS / 60} min
        </button>
      </div>
    );
  }

  return (
    <div className="sheet flex flex-col gap-4">
      <p className="text-xs text-muted">Time on this task: {formatDuration(liveSeconds)}</p>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Supervised review</p>
        <h2 className="mt-1 font-serif text-xl text-ink">Pick this session&apos;s topic</h2>
      </div>
      <div className="flex flex-col gap-2.5">
        {SUPERVISED_QUIZ_TOPIC_LIST.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTopicKey(t.key);
              setStage("notes");
            }}
            className={`flex flex-col gap-1 rounded-[8px] border border-border ${t.spineClass} border-l-[3px] bg-card px-4 py-3.5 text-left hover:border-primary`}
          >
            <span className="text-sm font-semibold text-ink">{t.title}</span>
            <span className="text-xs text-muted">{t.covers}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
