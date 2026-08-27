"use client";

import { useEffect, useRef, useState } from "react";
import type { RECORDING_PROMPTS } from "@/lib/fol/volunteer-signup-questions";

// Volunteer Sign-Up.dc.html screen 4: eight escalating prompts recorded as
// ONE continuous file -- "Next question" advances which prompt is shown,
// the recording never stops, and the candidate can listen back and
// re-record the whole thing as many times as they like. Deliberately
// different from the applicant speaking task's AudioRecorder (one prompt,
// one clip): here the prompt list is internal state, not a parent form
// field, because a single MediaRecorder session has to span all eight.
export function VolunteerRecorder({
  prompts,
  recordingConsentLine,
  onStatusChange,
}: {
  prompts: typeof RECORDING_PROMPTS;
  recordingConsentLine: string;
  onStatusChange?: (status: "idle" | "requesting" | "recording" | "reviewing" | "error") => void;
}) {
  const [consented, setConsented] = useState(false);
  const [status, setStatusRaw] = useState<"idle" | "requesting" | "recording" | "reviewing" | "error">("idle");
  function setStatus(next: "idle" | "requesting" | "recording" | "reviewing" | "error") {
    setStatusRaw(next);
    onStatusChange?.(next);
  }
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // Ramy, 25 Aug 2026: "it should be like a play pause sort of stuff on the
  // actual recording, not something hidden" -- a real toggle built into
  // the recording indicator itself, not a separate link. No early finish
  // (he removed that): the only way to end the recording for good is
  // still "Next question" through to the last prompt.
  const [paused, setPaused] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function watchLevel(stream: MediaStream) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = data[i] - 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length) / 128;
      setLevel(Math.min(1, rms * 4));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function startRecording() {
    setErrorMessage(null);
    setStatus("requesting");
    setPromptIndex(0);
    setPaused(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      watchLevel(stream);

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
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        audioCtxRef.current?.close();
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

  function nextQuestion() {
    if (promptIndex >= prompts.length - 1) {
      finishRecording();
      return;
    }
    setPromptIndex((i) => i + 1);
  }

  function finishRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function togglePause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (paused) {
      recorder.resume();
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
      setPaused(false);
    } else {
      recorder.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setPaused(true);
    }
  }

  function setFileFromBlob(blob: Blob) {
    const input = fileInputRef.current;
    if (!input) return;
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `volunteer-signup.${ext}`, { type: blob.type });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
  }

  function retake() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setElapsedSeconds(0);
    setPromptIndex(0);
    setPaused(false);
    setStatus("idle");
  }

  function formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const current = prompts[promptIndex];
  const isLast = promptIndex >= prompts.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <input ref={fileInputRef} type="file" name="audio" required className="hidden" accept="audio/*" />
      <input type="hidden" name="recording_consent_given" value={consented ? "true" : ""} />

      {status === "idle" || status === "requesting" || status === "error" ? (
        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-2.5 rounded-lg border border-[#eddfc4] bg-white p-3.5 text-sm text-[#3a2e18]">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5"
            />
            {recordingConsentLine}
          </label>
          <button
            type="button"
            onClick={startRecording}
            disabled={!consented || status === "requesting"}
            className="volunteer-hover-fill self-start rounded-lg bg-[#a8432e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {status === "requesting" ? "Requesting microphone…" : "Start recording"}
          </button>
          {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        </div>
      ) : null}

      {status === "recording" ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-full rounded-lg border border-[#eddfc4] bg-[#fbf3e3] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a6a2f]">
              Question {promptIndex + 1} of {prompts.length}
            </p>
            <p className="mt-1 text-lg text-[#3a2e18]">{current.question}</p>
          </div>

          {/* Ramy, 25 Aug 2026: "it should be like a play pause sort of
              stuff on the actual recording, not something hidden" -- the
              indicator itself is the pause/resume control now, not a
              separate link below it. No early finish (he removed that
              too): the only way to actually end the recording is still
              clicking through to the last question. */}
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? "Resume recording" : "Pause recording"}
            className="volunteer-hover-fill flex size-16 items-center justify-center rounded-full bg-[#a8432e] transition-transform"
            style={{ boxShadow: paused ? "none" : `0 0 0 ${6 + level * 10}px rgba(168,67,46,0.14)` }}
          >
            {paused ? (
              <div className="ml-0.5 size-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-white" />
            ) : (
              <div className="flex gap-1.5">
                <div className="h-5 w-1.5 rounded-[2px] bg-white" />
                <div className="h-5 w-1.5 rounded-[2px] bg-white" />
              </div>
            )}
          </button>

          <div className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full bg-[#a8432e] ${paused ? "" : "animate-pulse"}`} />
            <span className="text-sm font-semibold text-[#a8432e]">
              {paused ? "Paused" : "Recording"} · {formatTime(elapsedSeconds)}
            </span>
          </div>

          <p className="text-center text-xs text-[#8a6a2f]">
            The recording keeps going on its own -- click &quot;Next question&quot; when you&apos;re done talking.
          </p>

          <button
            type="button"
            onClick={nextQuestion}
            className="volunteer-hover-fill w-full max-w-xs rounded-lg bg-[#3a2e18] px-5 py-3 text-sm font-semibold text-white"
          >
            {isLast ? "Stop and finish" : "Next question →"}
          </button>
        </div>
      ) : null}

      {status === "reviewing" && audioUrl ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8a6a2f]">
              {formatTime(elapsedSeconds)} recorded
              {promptIndex + 1 >= prompts.length
                ? `, all ${prompts.length} questions`
                : `, ${promptIndex + 1} of ${prompts.length} questions`}
            </span>
            <button type="button" onClick={retake} className="ml-auto text-xs font-medium text-[#a8432e] hover:underline">
              Record again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
