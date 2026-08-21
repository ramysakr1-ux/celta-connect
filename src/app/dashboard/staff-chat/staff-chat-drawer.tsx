"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MessageThread, type MessageThreadHandle, type Message } from "@/app/dashboard/staff-chat/message-thread";
import type { ChannelSummary, Coworker } from "@/lib/staff-chat";

// apply-to-app.md §1 -- checkpoint 1 rewrite. Was hover-to-reveal on an
// invisible 44px strip (undiscoverable, unreachable by keyboard -- build-
// spec.md §8 bug 2). Now always present, dimmed at rest: a genuine idle
// timer instead of hover state, and dimming is purely visual (opacity/
// transform) -- pointer-events and keyboard focus work identically dimmed
// or awake, which is the actual fix for the bug this replaces.
const IDLE_MS = 3500;

function initials(name: string, isDm: boolean): string {
  if (isDm) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function channelMeta(type: ChannelSummary["type"]): string {
  if (type === "dm") return "trainer";
  if (type === "tp_group") return "TP group";
  // center_trainers / all_staff -- a real member count would need a new
  // query (ChannelSummary doesn't carry one today); "group" is the spec's
  // own sanctioned fallback, keeping this a presentation-only change.
  return "group";
}

function msUntilLocalMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  return `Clears in ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

export function StaffChatDrawer({
  profileId,
  initialChannels,
  coworkers,
  readOnly = false,
  staticMessages,
  quietHoursNote,
  raiseForMobileNav = false,
}: {
  profileId: string;
  initialChannels: ChannelSummary[];
  coworkers: Coworker[];
  // Used when a staff member is previewing a trainee's view (see
  // portfolio/[traineeId]/preview-chrome.tsx): shows the TRAINEE's own
  // channels/coworkers (not the staff member's) so the preview is
  // accurate, but never lets staff actually send as that trainee --
  // sending requires being logged in as them for real.
  readOnly?: boolean;
  // Server-fetched (admin-client) messages for the read-only preview case
  // -- see MessageThread's identical comment for why the client-side fetch
  // can't be trusted to see them itself under RLS. Passed straight through
  // to the one MessageThread instance this drawer ever shows at a time.
  staticMessages?: Message[];
  // remaining-compliance.md "Changed by decision": derived server-side from
  // the real timetable (see computeQuietHoursNote), trainee-only, purely
  // informational -- there's no message-holding infrastructure to actually
  // delay delivery until morning, this just sets the right expectation.
  quietHoursNote?: string | null;
  // specs/build-spec.md §7 mobile bottom tab bar (trainee-mobile-nav.tsx) is
  // a real, fixed, full-width bar below `md` -- this pill needs to sit
  // above it there, not underneath. Only ever true from the real trainee's
  // own (non-preview) render, since that's the only context the tab bar
  // itself renders in -- see portfolio/[traineeId]/layout.tsx.
  raiseForMobileNav?: boolean;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [selectedId, setSelectedId] = useState<string | null>(initialChannels[0]?.id ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [awake, setAwake] = useState(true);
  const [startingDm, setStartingDm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [msLeft, setMsLeft] = useState(0);
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageThreadRef = useRef<MessageThreadHandle>(null);
  const threadOpenRef = useRef(threadOpen);

  const selected = channels.find((c) => c.id === selectedId) ?? null;
  const groupChannel = channels.find((c) => c.type !== "dm") ?? null;
  const nameById = new Map(coworkers.map((c) => [c.id, c.full_name]));
  // Retention is per-channel now (its own course's setting, migration
  // 0154), not one number for the whole drawer -- "the one unacceptable
  // outcome is a bar promising a midnight clear on a centre [course] that
  // retains," so this must track whichever channel is actually open.
  const retentionDays = selected?.retentionDays ?? 1;
  const retentionLabel = selected?.retentionLabel ?? "nightly";

  useEffect(() => {
    threadOpenRef.current = threadOpen;
  }, [threadOpen]);

  // The idle timer never runs while a panel is open (re-arms the instant
  // both close, in addition to every explicit wake-trigger event below --
  // see the Escape/mouseenter/focus/keydown/click handlers).
  useEffect(() => {
    if (pickerOpen || threadOpen) return;
    const t = setTimeout(() => setAwake(false), IDLE_MS);
    return () => clearTimeout(t);
  }, [pickerOpen, threadOpen, awake]);

  function wake() {
    setAwake(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    wake();
    if (e.key === "Escape") {
      if (pickerOpen) setPickerOpen(false);
      else if (threadOpen) setThreadOpen(false);
    }
  }

  // Reset meter -- local midnight, same boundary as staff-chat.ts's
  // deleteStaleStaffMessages, so the countdown never lies about when
  // messages actually clear. Only meaningful for the Nightly (1-day)
  // default -- anything longer has no single shared clear moment to count
  // down to (each message ages out N days after IT was sent, not at a
  // shared boundary), so it gets static "resets on the course's schedule"
  // copy instead.
  useEffect(() => {
    if (retentionLabel !== "nightly") return;
    const update = () => setMsLeft(msUntilLocalMidnight());
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [retentionLabel]);

  // "The one unacceptable outcome is a bar promising a midnight clear on a
  // centre [course] that retains" -- each mode gets its own accurate copy,
  // never the nightly wording as a generic fallback.
  const retentionCopy =
    retentionLabel === "nightly"
      ? "clears at midnight"
      : retentionLabel === "course"
        ? "cleared when this course closes"
        : "resets on the course's schedule";

  useEffect(() => {
    if (channels.length === 0) return;
    const myChannelIds = new Set(channels.map((c) => c.id));
    const supabase = createClient();
    const channel = supabase
      .channel("staff_messages:unread-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_messages" },
        (payload) => {
          const msg = payload.new as { sender_id: string; channel_id: string };
          if (msg.sender_id === profileId || !myChannelIds.has(msg.channel_id)) return;
          if (!threadOpenRef.current) setUnreadCount((n) => n + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channels, profileId]);

  async function startDm(coworker: Coworker) {
    setStartingDm(true);
    const supabase = createClient();
    const { data: channelId, error } = await supabase.rpc("get_or_create_dm_channel", {
      other_profile_id: coworker.id,
    });
    setStartingDm(false);
    setPickerOpen(false);

    if (error || !channelId) return;

    setChannels((prev) =>
      prev.some((c) => c.id === channelId)
        ? prev
        // A DM has no course_id -- always the fixed 1-day default, same
        // as every other centre-wide channel.
        : [...prev, { id: channelId, type: "dm", name: coworker.full_name, retentionDays: 1, retentionLabel: "nightly" }]
    );
    setSelectedId(channelId);
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }

  function toggleThread() {
    setThreadOpen((open) => {
      const next = !open;
      if (next) setUnreadCount(0);
      return next;
    });
  }

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || !selected || readOnly) return;
    setBody("");
    requestAnimationFrame(resizeTextarea);
    // Delegate to the MessageThread instance actually showing this channel
    // -- it inserts and appends to its own local state directly, rather
    // than this component inserting separately and waiting on a realtime
    // round trip to reflect it.
    await messageThreadRef.current?.send(trimmed);
  }

  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 z-30 flex justify-center px-3 ${
        raiseForMobileNav ? "bottom-20 md:bottom-6" : "bottom-6"
      }`}
    >
      <div
        className={`pointer-events-auto flex w-full max-w-[840px] flex-col gap-2 transition-[opacity,transform] duration-[260ms] ease-out ${
          awake ? "translate-y-0 opacity-100" : "translate-y-3.5 opacity-40"
        }`}
        onMouseEnter={wake}
        onFocus={wake}
        onClick={wake}
        onKeyDown={handleKeyDown}
      >
        {/* Picker: a later sibling of the thread/bar (not a descendant of
            anything overflow-hidden), so it isn't clipped. */}
        {pickerOpen && !readOnly ? (
          <div className="w-[300px] self-start rounded-[16px] border border-border bg-card p-2 shadow-lg">
            <p className="px-3 pb-2 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Choose a channel
            </p>
            {groupChannel ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(groupChannel.id);
                  setPickerOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-left hover:bg-accent/40 ${
                  groupChannel.id === selectedId ? "bg-accent/25" : ""
                }`}
              >
                <span
                  className={`flex size-[26px] shrink-0 items-center justify-center rounded-[8px] text-[9px] font-semibold ${
                    groupChannel.id === selectedId ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                  }`}
                >
                  {initials(groupChannel.name, false)}
                </span>
                <span className="flex-1 truncate text-[13px] font-medium text-ink">{groupChannel.name}</span>
                <span className="shrink-0 text-[10px] text-muted">{channelMeta(groupChannel.type)}</span>
              </button>
            ) : null}
            {coworkers.map((c) => {
              const isSelected = selected?.name === c.full_name;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={startingDm}
                  onClick={() => startDm(c)}
                  className={`flex w-full items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-left hover:bg-accent/40 disabled:opacity-60 ${
                    isSelected ? "bg-accent/25" : ""
                  }`}
                >
                  <span
                    className={`flex size-[26px] shrink-0 items-center justify-center rounded-[8px] text-[9px] font-semibold ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {initials(c.full_name, true)}
                  </span>
                  <span className="flex-1 truncate text-[13px] font-medium text-ink">{c.full_name}</span>
                  <span className="shrink-0 text-[10px] text-muted">trainer</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {threadOpen ? (
          <div className="max-h-[260px] overflow-y-auto rounded-[20px] border border-border bg-card p-4 shadow-lg">
            {selected ? (
              <MessageThread
                ref={messageThreadRef}
                key={selected.id}
                channelId={selected.id}
                myProfileId={profileId}
                nameById={nameById}
                isGroup={selected.type !== "dm"}
                hideComposer
                staticMessages={staticMessages}
                retentionDays={retentionDays}
              />
            ) : null}
          </div>
        ) : null}

        {quietHoursNote && !readOnly ? (
          <p className="rounded-full bg-status-warning-bg px-3 py-1 text-center text-[11px] text-status-warning-text">{quietHoursNote}</p>
        ) : null}

        <div className="flex h-14 items-center gap-1.5 rounded-[28px] border border-border bg-card pl-2 pr-2.5 shadow-lg sm:gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={readOnly}
            aria-expanded={pickerOpen}
            aria-label="Choose who to message"
            className={`flex h-10 shrink-0 items-center gap-2 rounded-[20px] bg-accent/40 pl-2 pr-3 hover:bg-accent/60 ${
              readOnly ? "cursor-default opacity-60" : ""
            }`}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-primary text-[9px] font-semibold text-primary-foreground">
              {selected ? initials(selected.name, selected.type === "dm") : "+"}
            </span>
            <span className="max-w-[70px] truncate text-[13px] font-semibold text-ink sm:max-w-[130px]">
              {selected ? selected.name : "Pick who to message"}
            </span>
            {!readOnly ? <ChevronDown className="size-[9px] shrink-0 text-muted" aria-hidden="true" /> : null}
          </button>

          <div className="h-6 w-px shrink-0 bg-border" />

          {readOnly ? (
            <span className="min-w-0 flex-1 truncate text-xs text-muted">
              {selected ? `Previewing "${selected.name}" -- read-only` : "No channels yet"}
            </span>
          ) : (
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
              placeholder={selected ? `Message ${selected.name} -- ${retentionCopy}` : "Pick who to message"}
              disabled={!selected}
              className="max-h-24 min-w-0 flex-1 resize-none border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70 disabled:opacity-60"
            />
          )}

          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span className="size-[5px] shrink-0 rounded-full bg-muted" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
              {retentionLabel === "nightly"
                ? formatCountdown(msLeft)
                : retentionCopy.charAt(0).toUpperCase() + retentionCopy.slice(1)}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleThread}
            aria-expanded={threadOpen}
            className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-[17px] bg-accent/40 px-2 text-xs font-semibold hover:bg-accent/60 sm:px-3"
          >
            {threadOpen ? "Hide" : "Thread"}
            {!threadOpen && unreadCount > 0 ? (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1.5 text-[10px] font-semibold text-card">
                {unreadCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={readOnly || !selected || !body.trim()}
            aria-label="Send"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-card hover:bg-primary disabled:opacity-60"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
