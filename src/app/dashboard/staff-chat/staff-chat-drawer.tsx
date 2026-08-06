"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageThread, type MessageThreadHandle, type Message } from "@/app/dashboard/staff-chat/message-thread";
import type { ChannelSummary, Coworker } from "@/lib/staff-chat";

// Truly hidden by default (Mac-dock style) -- an invisible hover strip
// sits at the bottom of the screen; nothing is drawn until the cursor
// enters it, at which point the whole pill (recent messages, auto-height
// and capped, above an always-typeable compose row) fades/grows in from
// the bottom. Leaves the strip -> collapses back to fully invisible, not
// just shorter. Matches the page's content width on both sides (clear of
// the browser's own dev-mode indicator on the left, the "Designed by
// Ramy" footer credit on the right). The Send button flashes briefly on
// an incoming message so something can still signal through while hidden.
export function StaffChatDrawer({
  profileId,
  initialChannels,
  coworkers,
  readOnly = false,
  staticMessages,
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
}) {
  const [expanded, setExpanded] = useState(false);
  const [channels, setChannels] = useState(initialChannels);
  const [selectedId, setSelectedId] = useState<string | null>(initialChannels[0]?.id ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startingDm, setStartingDm] = useState(false);
  const [flash, setFlash] = useState(false);
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageThreadRef = useRef<MessageThreadHandle>(null);

  const selected = channels.find((c) => c.id === selectedId) ?? null;
  const groupChannel = channels.find((c) => c.type !== "dm") ?? null;
  const nameById = new Map(coworkers.map((c) => [c.id, c.full_name]));

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
          setFlash(true);
          setTimeout(() => setFlash(false), 4000);
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
        : [...prev, { id: channelId, type: "dm", name: coworker.full_name }]
    );
    setSelectedId(channelId);
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !selected) return;
    setBody("");
    requestAnimationFrame(resizeTextarea);

    // Delegate to the MessageThread instance actually showing this channel
    // -- it inserts and appends to its own local state directly, rather
    // than this component inserting separately and waiting on a realtime
    // round trip to reflect it (that round trip is best-effort and
    // shouldn't gate the sender seeing their own message land).
    await messageThreadRef.current?.send(trimmed);
  }

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        setExpanded(false);
        setPickerOpen(false);
      }}
      // Fixed-height invisible hover strip -- always occupies this space
      // (so there's something to mouse into) even though nothing is drawn
      // here when collapsed; the actual pill is absolutely positioned
      // inside, growing upward from this strip's bottom edge. Wide (matches
      // the page's content width) but deliberately SHORT when expanded --
      // this sits alongside watching a lesson/typing feedback, it must not
      // cover the screen vertically.
      className="fixed bottom-0 left-36 right-36 z-30 h-11"
    >
      {/* Anchored to the STRIP'S OWN bottom edge (true viewport bottom),
          not left to sit at its top via normal block flow -- a plain
          `relative h-0` div here collapses to zero height at the TOP of
          this 44px strip, which pulled the bottom-anchored card up with
          it, leaving a 44px gap between the expanded pill and the actual
          screen edge. */}
      <div className="absolute bottom-0 left-0 right-0 h-0">
        <div
          className={`absolute bottom-0 left-0 right-0 flex flex-col overflow-hidden rounded-[24px] border bg-card shadow-lg transition-all duration-200 ease-out ${
            expanded
              ? "max-h-[122px] border-border opacity-100"
              : "pointer-events-none max-h-0 border-transparent opacity-0"
          }`}
        >
          {/* Ramy, 2026-08-06: "we don't wanna clutter our system... it
              should be written on the pill itself so people understand it
              will not stay" -- messages actually do get deleted nightly
              now (deleteStaleStaffMessages in staff-chat.ts), this is
              just making that visible rather than a silent behavior. */}
          <p className="shrink-0 px-4 pt-2 text-[10px] text-muted">
            Messages reset nightly &mdash; nothing here is saved.
          </p>

          {selected ? (
            <MessageThread
              ref={messageThreadRef}
              key={selected.id}
              channelId={selected.id}
              myProfileId={profileId}
              nameById={nameById}
              isGroup={selected.type !== "dm"}
              hideComposer
              latestOnly
              staticMessages={staticMessages}
            />
          ) : null}

          {readOnly ? (
            // No compose form, no picker, no channel-switching -- sending
            // requires the get_or_create_dm_channel RPC, which would run as
            // the REAL staff identity, not the trainee being previewed, so
            // any interaction here would silently be wrong-identity. This
            // is a look, not a way in.
            <div className="flex items-center gap-2 p-2 text-xs text-muted">
              <span className="flex h-9 items-center rounded-[18px] border border-border bg-surface-muted px-4">
                {selected ? `Previewing "${selected.name}" -- read-only` : "No channels yet"}
              </span>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex items-end gap-2 p-2">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                aria-label="Choose who to message"
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none ${
                  pickerOpen ? "bg-primary text-card" : "border border-border text-muted hover:text-ink"
                }`}
              >
                +
              </button>

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
                    handleSend(e);
                  }
                }}
                placeholder={selected ? `Message ${selected.name}` : "Pick who to message"}
                disabled={!selected}
                className="max-h-24 flex-1 resize-none rounded-[18px] border border-border bg-card px-4 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={!selected || !body.trim()}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium text-card transition-shadow disabled:opacity-60 ${
                  flash ? "bg-primary shadow-[0_0_0_4px_var(--color-status-on-track-bg)]" : "bg-primary"
                }`}
              >
                Send
              </button>
            </form>
          )}
        </div>

        {/* Picker dropdown: a LATER sibling of the card above (not a
            descendant -- the card's overflow-hidden, needed for its collapse
            animation, would clip a popped-up descendant), anchored to the
            same true-bottom point and rendered after it in the DOM so it
            paints on top of the card rather than underneath it. */}
        {pickerOpen ? (
          <div className="absolute bottom-full left-0 mb-2 max-h-56 w-56 overflow-y-auto rounded-[10px] border border-border bg-card p-2 shadow-lg">
            {/* One flat list: the group first, then every trainer's name.
                No "existing channels" vs "start a DM" distinction -- clicking
                a name always takes you to (or starts) that conversation. */}
            {groupChannel ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(groupChannel.id);
                  setPickerOpen(false);
                }}
                className={`block w-full rounded-[6px] px-2 py-1.5 text-left text-sm ${
                  groupChannel.id === selectedId ? "bg-accent/40 text-ink" : "text-ink hover:bg-background"
                }`}
              >
                {groupChannel.name}
              </button>
            ) : null}
            {coworkers.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={startingDm}
                onClick={() => startDm(c)}
                className={`block w-full rounded-[6px] px-2 py-1.5 text-left text-sm disabled:opacity-60 ${
                  selected?.name === c.full_name ? "bg-accent/40 text-ink" : "text-ink hover:bg-background"
                }`}
              >
                {c.full_name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
