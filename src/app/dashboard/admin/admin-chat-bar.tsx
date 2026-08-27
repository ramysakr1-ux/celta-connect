"use client";

import { useRef, useState } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { MessageThread, type MessageThreadHandle } from "@/app/dashboard/staff-chat/message-thread";
import type { AdminChatRoom } from "@/lib/admin-chat";

// build-spec.md §12: the admin channel is "**Centre-scoped, not
// course-scoped.** Members: centre owner, centre admins, centre manager,
// course admins. No tutors, no candidates." Named after the centre, "so nobody
// assumes a message reaches tutors."
//
// This bar used to pick a COURSE, which §13 rejects from the other side too --
// an admin covering two cities "is having one conversation." It now picks a
// branch only when there is more than one, and otherwise shows the single room.
//
// Deliberately NOT built on StaffChatDrawer: that component's picker is
// person/DM-shaped and its labels are resolved for a TRAINER's view. No trainer
// is ever reachable here, and no admin is ever reachable from the trainer-only
// staff chat -- §10, "course chat is absent from every admin role, including
// centre owner. No exception, ever." The DATA/permissions stay this component's
// own -- for-claude-code-chat-pill-consistency.md's ask was never "merge these,"
// it was "same visual pill, same auto-hide, same auto-height, same bar layout
// (picker/composer/thread-toggle/send)" -- this rewrite matches that shell
// (mirrored from StaffChatDrawer's markup, same class names/behavior) while
// keeping the real admin-only, permanent-room logic untouched. The one slot
// that's genuinely different is where StaffChatDrawer shows a reset countdown
// -- this room never resets, so that slot reads "Permanent" instead, which is
// correct content for it, not a missing feature.

export function AdminChatBar({ profileId, rooms }: { profileId: string; rooms: AdminChatRoom[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(rooms[0]?.channelId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageThreadRef = useRef<MessageThreadHandle>(null);

  const selected = rooms.find((r) => r.channelId === selectedId) ?? rooms[0] ?? null;
  const nameById = new Map<string, string>();

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setPickerOpen(false);
      setThreadOpen(false);
    }
  }

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || !selected) return;
    setBody("");
    requestAnimationFrame(resizeTextarea);
    await messageThreadRef.current?.send(trimmed);
  }

  if (rooms.length === 0 || !selected) return null;

  return (
    // Ramy, 26 Aug 2026: "the chat pill is not really at the bottom...
    // it needs to go more further down at the bottom, not hovering."
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-30 flex justify-center px-3">
      <div className="pointer-events-auto flex w-full max-w-[840px] flex-col gap-2" onKeyDown={handleKeyDown}>
        {pickerOpen && rooms.length > 1 ? (
          <div className="w-[300px] self-start rounded-[16px] border border-border bg-card p-2 shadow-lg">
            <p className="px-3 pb-2 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Choose a branch</p>
            {rooms.map((r) => (
              <button
                key={r.channelId}
                type="button"
                onClick={() => {
                  setSelectedId(r.channelId);
                  setPickerOpen(false);
                }}
                className={`admin-hover flex w-full items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-left hover:bg-accent/40 ${
                  r.channelId === selected.channelId ? "bg-accent/25" : ""
                }`}
              >
                <span
                  className={`flex size-[26px] shrink-0 items-center justify-center rounded-[8px] text-[9px] font-semibold ${
                    r.channelId === selected.channelId ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                  }`}
                >
                  {r.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex-1 truncate text-[13px] font-medium text-ink">{r.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {threadOpen ? (
          <div className="max-h-[260px] overflow-y-auto rounded-[20px] border border-border bg-card p-4 shadow-lg">
            <p className="mb-2 text-[11px] text-muted">
              Admins only — this reaches no tutor and no candidate. To reach a tutor, use their contact details on the roster.
              <span className="ml-1 font-semibold text-ink">Permanent — never resets.</span>
            </p>
            <MessageThread
              ref={messageThreadRef}
              key={selected.channelId}
              channelId={selected.channelId}
              myProfileId={profileId}
              nameById={nameById}
              isGroup
              hideComposer
              retentionDays={null}
            />
          </div>
        ) : null}

        <div className="flex min-h-14 items-center gap-1.5 rounded-[28px] border border-border bg-card pl-2 pr-2.5 shadow-lg sm:gap-3">
          <button
            type="button"
            onClick={() => rooms.length > 1 && setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label="Choose a branch"
            className={`admin-hover-fill flex h-10 shrink-0 items-center gap-2 rounded-[20px] bg-accent/40 pl-2 pr-3 hover:bg-accent/60 ${
              rooms.length <= 1 ? "cursor-default" : ""
            }`}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-primary text-[9px] font-semibold text-primary-foreground">
              {selected.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="max-w-[70px] truncate text-[13px] font-semibold text-ink sm:max-w-[130px]">{selected.name}</span>
            {rooms.length > 1 ? <ChevronDown className="size-[9px] shrink-0 text-muted" aria-hidden="true" /> : null}
          </button>

          <div className="h-6 w-px shrink-0 bg-border" />

          <textarea
            ref={textareaRef}
            rows={1}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${selected.name}`}
            className="max-h-24 min-w-0 flex-1 resize-none border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
          />

          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span className="size-[5px] shrink-0 rounded-full bg-muted" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">Permanent</span>
          </div>

          <button
            type="button"
            onClick={() => setThreadOpen((v) => !v)}
            aria-expanded={threadOpen}
            className="admin-hover-fill flex h-[34px] shrink-0 items-center gap-1.5 rounded-[17px] bg-accent/40 px-2 text-xs font-semibold hover:bg-accent/60 sm:px-3"
          >
            {threadOpen ? "Hide" : "Thread"}
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!body.trim()}
            aria-label="Send"
            className="admin-hover-fill flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-card hover:bg-primary disabled:opacity-60"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
