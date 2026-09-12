"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PenLine, X, Trash2, Mic, Square } from "lucide-react";
import { deleteTraineeNote, saveTraineeNote, saveVoiceNote, setNotebookPaper } from "@/app/portfolio/[traineeId]/notebook-actions";
import type { NotebookPaper, TraineeNote } from "@/lib/trainee-notebook";
import { formatDate } from "@/lib/format-date";

// The trainee's notebook. Ramy, 12 Sep 2026: "like having a notebook with
// you" -- a small round pen fixed in the corner of every page, a panel that
// slides over the page (the page stays put, so the feedback is still there
// to read while you write), one long scrolling notebook, newest at the top,
// cursor in the empty box, saved as you type. Each note remembers the page
// it was written on -- "TP4 feedback" -- without the trainee typing it.
// Private: the table's only policies are the trainee's own.
//
// The paper is theirs to choose (Ramy: "you can choose what colour paper you
// want") -- six faint papers, blue by default, kept off the app's own teal /
// garnet / gold so the notebook never reads as a status.

const PAPER: Record<NotebookPaper, { bg: string; edge: string; label: string }> = {
  blue: { bg: "oklch(96.2% 0.022 235)", edge: "oklch(88% 0.045 235)", label: "Blue" },
  pink: { bg: "oklch(96.5% 0.02 350)", edge: "oklch(89% 0.045 350)", label: "Pink" },
  cream: { bg: "oklch(97% 0.024 90)", edge: "oklch(89% 0.05 90)", label: "Cream" },
  mint: { bg: "oklch(96.5% 0.022 160)", edge: "oklch(88.5% 0.045 160)", label: "Mint" },
  lavender: { bg: "oklch(96.5% 0.022 300)", edge: "oklch(89% 0.045 300)", label: "Lavender" },
  white: { bg: "oklch(99% 0.003 90)", edge: "oklch(90% 0.01 85)", label: "Plain" },
};
const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(48% 0.017 70)";

/** "TP4 feedback", "Lessons from the Classroom", "Timetable" -- from the URL. */
function labelFor(pathname: string, traineeId: string, assignmentTitles: Record<string, string>): string {
  const rest = pathname.replace(`/portfolio/${traineeId}`, "").replace(/^\/+|\/+$/g, "");
  const [head, second] = rest.split("/");
  if (!head) return "Course stream";
  switch (head) {
    case "tp":
      return second ? `TP${second}` : "Teaching practice";
    case "assignments":
      return second ? (assignmentTitles[second] ?? "Assignment") : "Assignments";
    case "timetable":
      return "Timetable";
    case "resources":
      return "Resource hub";
    case "session-materials":
      return "Session materials";
    case "celta5":
      return "CELTA 5";
    case "progress":
      return "Progress";
    case "pre-course-task":
      return "Pre-course task";
    case "gtky":
      return "Getting to know you";
    case "stage2-tutorial":
      return "Stage 2 tutorial";
    case "individual-tutorial":
      return "Tutorial";
    case "consultation":
      return "Consultation";
    case "filmed-observation":
      return "Filmed observation";
    case "supervised":
      return "Supervised session";
    case "letters":
      return "Letters";
    default:
      return head.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }
}

export function TraineeNotebook({
  traineeId,
  initialNotes,
  initialPaper,
  assignmentTitles,
  timeZone,
}: {
  traineeId: string;
  initialNotes: TraineeNote[];
  initialPaper: NotebookPaper;
  assignmentTitles: Record<string, string>;
  timeZone: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [paper, setPaper] = useState<NotebookPaper>(initialPaper);
  const [notes, setNotes] = useState<TraineeNote[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef<string | null>(null);
  // Voice notes (migration 0294): the same MediaRecorder capture the
  // speaking task uses, no review step -- stop is save. The transcript
  // comes back as the note's text; the recording stays playable under it.
  const [rec, setRec] = useState<"idle" | "requesting" | "recording" | "saving" | "error">("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recSecondsRef = useRef(0);
  const anchor = useMemo(() => ({ path: pathname, label: labelFor(pathname, traineeId, assignmentTitles) }), [pathname, traineeId, assignmentTitles]);

  useEffect(() => {
    if (open) setTimeout(() => draftRef.current?.focus(), 50);
  }, [open]);

  // Ctrl/Cmd + Shift + N opens it; Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Saved as you type: the first keystroke creates the note (anchored to
  // this page), later ones update it. A new box opens when this one is
  // committed -- closing the panel or pressing "New note".
  const flush = useCallback(
    async (body: string) => {
      if (!body.trim() && !draftIdRef.current) return;
      setStatus("saving");
      const res = await saveTraineeNote({ id: draftIdRef.current, body, anchorPath: anchor.path, anchorLabel: anchor.label });
      if (res.error) {
        setStatus("error");
        return;
      }
      setStatus("saved");
      if (res.id && !draftIdRef.current) {
        draftIdRef.current = res.id;
        setDraftId(res.id);
        const now = new Date().toISOString();
        setNotes((n) => [{ id: res.id!, anchor_path: anchor.path, anchor_label: anchor.label, body, created_at: now, updated_at: now }, ...n]);
      } else if (res.id) {
        setNotes((n) => n.map((x) => (x.id === res.id ? { ...x, body, updated_at: new Date().toISOString() } : x)));
      }
    },
    [anchor]
  );
  const onDraft = (value: string) => {
    setDraft(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(value), 700);
  };
  const commitDraft = () => {
    if (timer.current) clearTimeout(timer.current);
    if (draft.trim()) void flush(draft);
    setDraft("");
    setDraftId(null);
    draftIdRef.current = null;
    setStatus("idle");
  };
  const close = () => {
    commitDraft();
    setOpen(false);
  };

  const editNote = (id: string, body: string) => {
    setNotes((n) => n.map((x) => (x.id === id ? { ...x, body } : x)));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveTraineeNote({ id, body, anchorPath: "", anchorLabel: "" }).then((r) => setStatus(r.error ? "error" : "saved"));
    }, 700);
  };
  const removeNote = (id: string) => {
    setNotes((n) => n.filter((x) => x.id !== id));
    if (draftIdRef.current === id) {
      draftIdRef.current = null;
      setDraftId(null);
      setDraft("");
    }
    void deleteTraineeNote(id);
  };
  const choosePaper = (p: NotebookPaper) => {
    setPaper(p);
    try {
      localStorage.setItem("connect.notebook.paper", p);
    } catch {}
    void setNotebookPaper(p);
  };

  const startRecording = async () => {
    setRec("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (recTimer.current) clearInterval(recTimer.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
        const fd = new FormData();
        fd.set("audio", new File([blob], `note.${ext}`, { type: blob.type }));
        fd.set("anchor_path", anchor.path);
        fd.set("anchor_label", anchor.label);
        fd.set("seconds", String(recSecondsRef.current));
        setRec("saving");
        const res = await saveVoiceNote(fd);
        if (res.error || !res.note) {
          setRec("error");
          return;
        }
        setNotes((n) => [res.note!, ...n]);
        setRec("idle");
      };
      recorder.start();
      recSecondsRef.current = 0;
      setRecSeconds(0);
      recTimer.current = setInterval(() => {
        recSecondsRef.current += 1;
        setRecSeconds(recSecondsRef.current);
      }, 1000);
      setRec("recording");
    } catch {
      setRec("error");
    }
  };
  const stopRecording = () => recorderRef.current?.stop();
  useEffect(
    () => () => {
      if (recTimer.current) clearInterval(recTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );
  const mmss = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

  const p = PAPER[paper];
  const sameDay = (iso: string) => formatDate(iso, timeZone);

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Close your notebook" : "Open your notebook"}
        title="Your notebook (Ctrl/Cmd + Shift + N)"
        // Above the mobile nav and the chat pill below md, same offsets the
        // form submit bar uses so nothing in the corner overlaps.
        className="fixed right-4 bottom-40 z-40 flex size-12 items-center justify-center rounded-full shadow-[0_8px_24px_oklch(23.5%_0.017_65_/_0.22)] transition-transform hover:scale-105 md:right-5 md:bottom-2"
        style={{ background: open ? INK : p.bg, color: open ? "oklch(98.5% 0.006 90)" : INK, border: `1.5px solid ${open ? INK : p.edge}` }}
      >
        {open ? <X size={18} /> : <PenLine size={19} />}
      </button>

      {open ? (
        <>
          <button type="button" aria-label="Close" onClick={close} className="fixed inset-0 z-30 cursor-default bg-transparent md:bg-[oklch(23.5%_0.017_65_/_0.08)]" />
          <aside
            role="dialog"
            aria-label="Your notebook"
            className="fixed inset-y-0 right-0 z-40 flex w-full flex-col md:w-[min(420px,92vw)]"
            style={{ background: p.bg, borderLeft: `1px solid ${p.edge}`, boxShadow: "-12px 0 40px oklch(23.5% 0.017 65 / 0.12)" }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${p.edge}` }}>
              <div>
                <p className="font-serif text-[19px] font-semibold" style={{ color: INK }}>
                  Your notebook
                </p>
                <p className="text-[11px]" style={{ color: MUTED }}>
                  Yours only -- tutors and assessors never see it. Saved as you type; a voice note is kept and typed out for you.
                </p>
              </div>
              <div className="flex items-center gap-1.5" title="Paper">
                {(Object.keys(PAPER) as NotebookPaper[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={`${PAPER[k].label} paper`}
                    title={PAPER[k].label}
                    onClick={() => choosePaper(k)}
                    className="size-5 rounded-full transition-transform hover:scale-110"
                    style={{ background: PAPER[k].bg, border: `1.5px solid ${k === paper ? INK : PAPER[k].edge}`, boxShadow: k === paper ? `0 0 0 2px ${p.bg}, 0 0 0 3px ${INK}` : "none" }}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="rounded-[10px] px-3.5 py-3" style={{ background: "oklch(100% 0 0 / 0.55)", border: `1px solid ${p.edge}` }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase" style={{ color: MUTED }}>
                    {anchor.label} · {sameDay(new Date().toISOString())}
                  </span>
                  <span className="flex items-center gap-2 text-[10.5px]" style={{ color: status === "error" ? "oklch(45% 0.15 27)" : MUTED }}>
                    {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save" : ""}
                    {rec === "recording" ? (
                      <button type="button" onClick={stopRecording} className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold" style={{ background: "oklch(45% 0.15 27)", color: "oklch(98.5% 0.006 90)" }}>
                        <span className="block size-1.5 animate-pulse rounded-full bg-current" />
                        {mmss(recSeconds)}
                        <Square size={10} />
                      </button>
                    ) : rec === "saving" ? (
                      <span>Transcribing…</span>
                    ) : rec === "requesting" ? (
                      <span>Microphone…</span>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        aria-label="Record a voice note"
                        title="Record a voice note"
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold transition-colors hover:brightness-95"
                        style={{ background: "oklch(100% 0 0 / 0.7)", border: `1px solid ${p.edge}`, color: INK }}
                      >
                        <Mic size={11} /> Voice
                      </button>
                    )}
                  </span>
                </div>
                {rec === "error" ? (
                  <p className="mt-1 text-[11px]" style={{ color: "oklch(45% 0.15 27)" }}>
                    Couldn&apos;t record -- check the microphone permission for this site, then try again.
                  </p>
                ) : null}
                <textarea
                  ref={draftRef}
                  value={draft}
                  onChange={(e) => onDraft(e.target.value)}
                  placeholder="Write here…"
                  rows={4}
                  className="mt-1.5 w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none"
                  style={{ color: INK }}
                />
                {draftId ? (
                  <div className="flex justify-end">
                    <button type="button" onClick={commitDraft} className="text-[11.5px] font-semibold hover:underline" style={{ color: MUTED }}>
                      New note
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {notes
                  .filter((n) => n.id !== draftId)
                  .map((n) => (
                    <div key={n.id} className="group rounded-[10px] px-3.5 py-3" style={{ background: "oklch(100% 0 0 / 0.35)", border: `1px solid ${p.edge}` }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase" style={{ color: MUTED }}>
                          {n.anchor_label || "Note"} · {sameDay(n.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeNote(n.id)}
                          aria-label="Delete this note"
                          className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                          style={{ color: MUTED }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {n.audio_url ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <audio src={n.audio_url} controls preload="none" className="h-8 w-full" />
                          {n.audio_duration_seconds ? (
                            <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: MUTED }}>
                              {mmss(n.audio_duration_seconds)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <textarea
                        value={n.body}
                        placeholder={n.audio_path ? "Transcript unavailable -- type what you said, or leave the recording as it is." : undefined}
                        onChange={(e) => editNote(n.id, e.target.value)}
                        rows={Math.min(12, Math.max(2, n.body.split("\n").length + 1))}
                        className="mt-1 w-full resize-none bg-transparent text-[13.5px] leading-relaxed outline-none"
                        style={{ color: INK }}
                      />
                    </div>
                  ))}
                {notes.length === 0 && !draftId ? (
                  <p className="px-1 text-[12.5px]" style={{ color: MUTED }}>
                    Nothing here yet. Whatever you write remembers the page you wrote it on -- a TP&apos;s feedback, an assignment, a session.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
