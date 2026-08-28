"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseVideoUrl } from "@/lib/video-url";
import { useYouTubePlayer } from "@/lib/use-youtube-player";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addFilmedObservationTimestampedNote } from "@/app/portfolio/[traineeId]/filmed-observation-actions";
import { FilmedObservationTaskPanel } from "@/app/portfolio/[traineeId]/filmed-observation/[sessionId]/task-panel";
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
  taskPrompts,
  ratingLabel,
  ratingOptions,
  initialResponses,
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
  taskPrompts: string[];
  ratingLabel: string | null;
  ratingOptions: string[];
  initialResponses: Record<string, string>;
  nameById: Map<string, string>;
  initialMessages: Message[];
  initialSeekSeconds: number | null;
}) {
  const video = parseVideoUrl(recordingUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isYouTube = video?.kind === "youtube";
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
    if (isYouTube) ytPlayerRef.current?.playVideo();
    else videoRef.current?.play();
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

  // One rule for both players: the only difference is who gets told to
  // pause. Kept in a ref because the YouTube poller holds onto it, and a
  // stale closure here would mean a break that never fires.
  const activeBreakRef = useRef<Break | null>(null);
  activeBreakRef.current = activeBreak;

  const checkBreaks = useCallback(
    (currentSeconds: number, pause: () => void) => {
      if (activeBreakRef.current) return;
      const due = breaks
        .filter((b) => !shownBreakIds.current.has(b.id) && currentSeconds >= b.timestamp_seconds - 0.5)
        .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)[0];
      if (!due) return;
      shownBreakIds.current.add(due.id);
      pause();
      setCountdown(due.duration_seconds);
      setActiveBreak(due);
    },
    [breaks]
  );

  const { containerRef: ytContainerRef, playerRef: ytPlayerRef } = useYouTubePlayer({
    videoId: isYouTube ? video.videoId : null,
    enabled: isYouTube,
    onTick: (t) => checkBreaks(t, () => ytPlayerRef.current?.pauseVideo()),
  });

  function onTimeUpdate() {
    const el = videoRef.current;
    if (!el) return;
    checkBreaks(el.currentTime, () => el.pause());
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
    // Ramy, 29 Aug 2026: "it's not half the screen task, half the screen
    // video -- it's one quarter task, one quarter video, and then the rest
    // of the screen is just other stuff." He was right, and the arithmetic
    // was worse than it looked: .container caps at 1280px and centres, so a
    // 1920px screen loses ~640px to margin before this page starts. Minus
    // the portfolio sidebar (~180px), the frame's padding (~48px) and a
    // 340px rail, the video was left about 660px wide -- a third of the
    // screen, next to a third of the screen showing nothing.
    //
    // This is a video-watching page, so the reading-width constraint that
    // is right for text pages is wrong here. The negative margin escapes
    // .container and the frame padding to take the real viewport width;
    // everything else on the page keeps its normal measure.
    //
    // The video is also capped by height, not just width: on an ultrawide
    // it would otherwise grow past the fold and push the task off-screen,
    // which is the same problem in the other direction.
    // No w-screen: 100vw includes the scrollbar, so it would add a
    // horizontal scrollbar on any page tall enough to have a vertical one.
    // A block element already fills its container, and the negative margins
    // widen that container to the viewport.
    <div className="mx-[calc(50%-50vw)] grid grid-cols-1 gap-4 px-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-6 xl:px-8">
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

        <div className="relative mx-auto w-full max-w-[min(100%,calc((100vh-15rem)*16/9))] overflow-hidden rounded-[10px] border border-border bg-ink">
          {video?.kind === "youtube" ? (
            // Ramy, 29 Aug 2026: the recordings are YouTube links, and the
            // discussion breaks have to pause them ("the film will pause...
            // three pauses for sixty or ninety seconds"). A plain <iframe>
            // cannot be paused from this page, so the YouTube IFrame Player
            // API mounts its own iframe into this div and we drive it.
            // No API key involved -- that is the Data API, a different
            // thing; this one is a script anyone can load.
            <div ref={ytContainerRef} className="aspect-video w-full bg-black [&>iframe]:h-full [&>iframe]:w-full" />
          ) : video?.kind === "file" ? (
            <video
              ref={videoRef}
              src={video.src}
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
            {breaks.length} break{breaks.length === 1 ? "" : "s"} in this recording — it pauses on its own so you can
            catch up on your notes and compare notes with your TP group. Skip a pause with &ldquo;Resume now&rdquo;.
          </p>
        ) : null}

        {taskId ? (
          // Decorative teal/garnet alternation against the lesson-info card
          // above -- no status meaning of its own, same rule as elsewhere.
          <div className="card card-garnet p-4">
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
                    className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink trainee-hover-fill"
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

      {/* Ramy, 29 Aug 2026: the per-session chat box is gone. "They can
          only talk to their TP group. They don't have to talk to everybody
          -- they have their chat pill, they can talk during the pause with
          the TP group. And they have now a chance to watch and type at the
          same time. It's only forty-five minutes, we don't want to waste
          too much time."
          Two chat boxes on one screen was the real problem: the pill is
          already mounted in the portfolio layout, so it is on this page
          anyway, and a trainee's group channel there IS their TP group.
          Giving the whole rail to the task is what lets them watch and
          write at once instead of leaving the video to answer.
          filmed_observation_messages and its component are deliberately
          left in place rather than deleted -- an empty table costs nothing,
          and if the per-session thread is ever wanted back the data layer
          is still there. */}
      <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <FilmedObservationTaskPanel
          traineeId={traineeId}
          sessionId={sessionId}
          taskId={taskId}
          prompts={taskPrompts}
          ratingLabel={ratingLabel}
          ratingOptions={ratingOptions}
          initialResponses={initialResponses}
          criteriaLine={criteriaLine}
          completedAt={taskCompletedAt}
        />
      </div>
    </div>
  );
}
