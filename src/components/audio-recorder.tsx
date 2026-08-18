"use client";

import { useEffect, useRef, useState } from "react";

// Shared recording UI (design_handoff_pre_interview_speaking): local
// in-browser capture, running timer while recording, playback review,
// unlimited retakes, only the final take submitted. Built once here so
// the pre-interview speaking task and any future recording surface (e.g.
// volunteer sign-up) don't each reinvent MediaRecorder plumbing.
//
// Sets the finished clip onto a hidden <input type="file"> via the
// DataTransfer trick so it rides along as an ordinary FormData entry when
// the surrounding <form action={...}> submits -- no separate upload call
// needed from this component.
export function AudioRecorder({ name, required }: { name: string; required?: boolean }) {
  const [status, setStatus] = useState<"idle" | "requesting" | "recording" | "reviewing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setErrorMessage(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setFileFromBlob(blob);
        setStatus("reviewing");
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setStatus("recording");
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch {
      setStatus("error");
      setErrorMessage("Couldn't access your microphone. Check your browser's permission for this site and try again.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function setFileFromBlob(blob: Blob) {
    const input = fileInputRef.current;
    if (!input) return;
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `recording.${ext}`, { type: blob.type });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
  }

  function retake() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setElapsedSeconds(0);
    setStatus("idle");
  }

  function formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col gap-3 rounded-[6px] border border-border bg-card p-4">
      <input ref={fileInputRef} type="file" name={name} required={required} className="hidden" accept="audio/*" />

      {status === "idle" || status === "requesting" || status === "error" ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={startRecording}
            disabled={status === "requesting"}
            className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {status === "requesting" ? "Requesting microphone…" : "Start recording"}
          </button>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </div>
      ) : null}

      {status === "recording" ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" />
            Recording
          </span>
          <span className="tabular-nums text-sm text-ink">{formatTime(elapsedSeconds)}</span>
          <button
            type="button"
            onClick={stopRecording}
            className="ml-auto rounded-[6px] border border-border px-3.5 py-1.5 text-sm font-medium text-ink hover:border-primary"
          >
            Stop
          </button>
        </div>
      ) : null}

      {status === "reviewing" && audioUrl ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{formatTime(elapsedSeconds)} recorded</span>
            <button type="button" onClick={retake} className="ml-auto text-xs font-medium text-primary hover:underline">
              Retake
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
