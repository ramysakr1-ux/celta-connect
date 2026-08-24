"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addFilmedObservationTimestampedNote } from "@/app/portfolio/[traineeId]/filmed-observation-actions";
import { FilmedObservationChat } from "@/app/portfolio/[traineeId]/filmed-observation/[sessionId]/chat";
import type { Database } from "@/lib/supabase/types";

type Break = Database["public"]["Tables"]["filmed_observation_breaks"]["Row"];
type Message = Database["public"]["Tables"]["filmed_observation_messages"]["Row"];

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.max(0, Math.floor(totalSeconds % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function FilmedObservationWatchScreen({
  traineeId,
  sessionId,
  myProfileId,
  myName,
  recordingUrl,
  level,
  learnerCount,
  teacherName,
  mainAim,
  subAim,
  breaks,
  taskId,
  criteriaLine,
  taskCompletedAt,
  nameById,
  initialMessages,
  initialSeekSeconds,
}: {
  traineeId: string;
  sessionId: string;
  myProfileId: string;
  myName: string;
  recordingUrl: string | null;
  level: string | null;
  learnerCount: number | null;
  teacherName: string | null;
  mainAim: string | null;
  subAim: string | null;
  breaks: Break[];
  taskId: string | null;
  criteriaLine: string | null;
  taskCompletedAt: string | null;
  nameById: Map<string, string>;
  initialMessages: Message[];
  initialSeekSeconds: number | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shownBreakIds = useRef<Set<string>>(new Set());
  const [activeBreak, setActiveBreak] = useState<Break | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [present, setPresent] = useState<string[]>([myName]);
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  // Presence: who's currently in this watch session, live -- the "{n} of
  // {n} joined" row. Anyone rewatching solo just sees a presence of one
  // (themselves), which is correct: the point is showing who's here now,
  // not enforcing that anyone else has to be.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`filmed_observation_presence:${sessionId}`, {
      config: { presence: { key: myProfileId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name: string }>();
        setPresent(Object.values(state).map((entries) => entries[0]?.name ?? "?"));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ name: myName });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, myProfileId, myName]);

  // Arriving via a "click a timestamp" link from the full task page --
  // seek there once the video can actually accept a currentTime write.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || initialSeekSeconds === null) return;
    const seek = () => {
      video.currentTime = initialSeekSeconds;
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [initialSeekSeconds]);

  function resumePlayback() {
    setActiveBreak(null);
    videoRef.current?.play();
  }

  // The countdown's starting value is set at the moment a break triggers
  // (onTimeUpdate below, synchronously with setActiveBreak) -- this effect
  // only owns the ticking interval, so it never calls setState directly in
  // its own body.
  useEffect(() => {
    if (!activeBreak) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          resumePlayback();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
     
  }, [activeBreak]);

  function onTimeUpdate() {
    const video = videoRef.current;
    if (!video || activeBreak) return;
    const due = breaks
      .filter((b) => !shownBreakIds.current.has(b.id) && video.currentTime >= b.timestamp_seconds - 0.5)
      .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)[0];
    if (due) {
      shownBreakIds.current.add(due.id);
      video.pause();
      setCountdown(due.duration_seconds);
      setActiveBreak(due);
    }
  }

  async function addNoteAtCurrentTime() {
    const trimmed = noteText.trim();
    if (!trimmed || !taskId || !videoRef.current) return;
    const fd = new FormData();
    fd.set("task_id", taskId);
    fd.set("timestamp_seconds", String(Math.floor(videoRef.current.currentTime)));
    fd.set("note", trimmed);
    setNoteText("");
    await addFilmedObservationTimestampedNote(fd);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {present.slice(0, 6).map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-accent text-[10px] font-semibold text-accent-foreground"
                title={name}
              >
                {name.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-xs text-muted">
            {present.length} joined{present.length > 6 ? ` (+${present.length - 6} more)` : ""}
          </span>
        </div>

        {teacherName || level || learnerCount !== null || mainAim || subAim ? (
          <div className="card p-4">
            {teacherName || level || learnerCount !== null ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
                {teacherName ? (
                  <span>
                    <span className="text-muted">Teacher</span> · {teacherName}
                  </span>
                ) : null}
                {level ? (
                  <span>
                    <span className="text-muted">Level</span> · {level}
                  </span>
                ) : null}
                {learnerCount !== null ? (
                  <span>
                    <span className="text-muted">Learners</span> · {learnerCount}
                  </span>
                ) : null}
              </div>
            ) : null}
            {mainAim ? (
              <p className={`text-sm text-ink ${teacherName || level || learnerCount !== null ? "mt-2" : ""}`}>
                <span className="text-muted">Main aim</span> · {mainAim}
              </p>
            ) : null}
            {subAim ? (
              <p className="mt-1 text-sm text-ink">
                <span className="text-muted">Sub aim</span> · {subAim}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted">
          This recording can run past 45 minutes. Use the player&apos;s own seek bar to fast-forward — you&apos;re not
          expected to watch every second, just enough to answer the task.
        </p>

        <div className="relative overflow-hidden rounded-[10px] border border-border bg-ink">
          {recordingUrl ? (
            <video
              ref={videoRef}
              src={recordingUrl}
              controls
              onTimeUpdate={onTimeUpdate}
              className="aspect-video w-full bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 bg-ink text-center text-card">
              <p className="text-sm font-semibold">No recording loaded</p>
              <p className="max-w-xs text-xs text-card/70">Your tutor attaches the recording before the session -- check back closer to the start time.</p>
            </div>
          )}

          {activeBreak ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/92 px-6 text-center text-card">
              <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-card/70">
                Break {activeBreak.break_number} of {breaks.length}
              </p>
              <p className="max-w-md text-base leading-relaxed">{activeBreak.prompt}</p>
              <p className="text-2xl font-semibold tabular-nums text-status-warning-text">{formatClock(countdown)}</p>
              <button
                type="button"
                onClick={resumePlayback}
                className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Resume now
              </button>
            </div>
          ) : null}
        </div>

        {breaks.length > 0 ? (
          <p className="text-xs text-muted">
            {breaks.length} discussion break{breaks.length === 1 ? "" : "s"} scheduled in this recording.
          </p>
        ) : null}

        {taskId ? (
          <div className="card p-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Observation task</p>
            {criteriaLine ? <p className="mt-1 text-sm text-ink">{criteriaLine}</p> : null}
            {taskCompletedAt ? (
              <p className="mt-2 text-sm font-semibold text-primary">Marked complete</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Quick note at this point in the video..."
                    className="flex-1 rounded-[6px] border border-border bg-card-inset px-2.5 py-1.5 text-sm text-ink outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={addNoteAtCurrentTime}
                    className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink trainee-hover"
                  >
                    {noteSaved ? "Saved" : "Add note"}
                  </button>
                </div>
                <Link
                  href={`/portfolio/${traineeId}/filmed-observation/${sessionId}/task`}
                  className="self-start text-sm font-medium text-primary hover:underline"
                >
                  See the full task page ↗
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="h-[520px] lg:h-auto">
        <FilmedObservationChat sessionId={sessionId} myProfileId={myProfileId} nameById={nameById} initialMessages={initialMessages} />
      </div>
    </div>
  );
}
