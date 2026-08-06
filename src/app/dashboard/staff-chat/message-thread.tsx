"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

export type Message = Database["public"]["Tables"]["staff_messages"]["Row"];

// Exposed so a parent that owns its own compose row (the drawer's merged
// pill) can trigger a send without a second <form> -- see staff-chat-drawer.tsx.
export interface MessageThreadHandle {
  send: (body: string) => Promise<void>;
}

export const MessageThread = forwardRef<
  MessageThreadHandle,
  {
    channelId: string;
    myProfileId: string;
    nameById: Map<string, string>;
    isGroup: boolean;
    // The staff chat drawer owns a single always-visible compose bar of its
    // own now (see staff-chat-drawer.tsx) -- when this thread is only being
    // shown as a history panel above that bar, skip rendering a second input.
    hideComposer?: boolean;
    // Compact preview mode for the drawer: show just the most recent message,
    // sized to its own content, sitting right above the compose row -- not a
    // scrolling multi-message history panel.
    latestOnly?: boolean;
    // Server-fetched messages for a channel the CURRENT browser session
    // can't itself read under RLS (a staff member previewing a trainee's
    // channel, which they're not a member of -- confirmed live, the
    // client-side fetch below silently returns empty in that case, same
    // RLS boundary as the channel list originally hit). When provided,
    // skips the fetch AND the realtime subscription entirely and just
    // renders these -- a static look, not a live one, which matches
    // read-only preview anyway (nothing to subscribe to updates for).
    staticMessages?: Message[];
  }
>(function MessageThread(
  { channelId, myProfileId, nameById, isGroup, hideComposer = false, latestOnly = false, staticMessages },
  ref
) {
  const [messages, setMessages] = useState<Message[]>(staticMessages ?? []);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(!staticMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Dedupes against whatever a later realtime delivery (or another insert)
  // brings in -- an id already present is never appended twice.
  function addMessage(m: Message) {
    setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
  }

  useEffect(() => {
    if (staticMessages) return;
    const supabase = createClient();
    let cancelled = false;

    // Display-side safety net for the "resets nightly" rule -- the actual
    // delete runs server-side (staff-chat.ts's deleteStaleStaffMessages,
    // called whenever a chat-enabled page loads), but this filter means a
    // stale row never shows up here even in the gap before that next runs.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    supabase
      .from("staff_messages")
      .select("*")
      .eq("channel_id", channelId)
      .gte("created_at", startOfToday.toISOString())
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) {
          setMessages(data ?? []);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(`staff_messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "staff_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          addMessage(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [channelId, staticMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Send-and-append locally instead of waiting on the realtime round trip
  // to reflect the sender's own message -- the insert reliably succeeds
  // (confirmed via the REST response), but the postgres_changes delivery
  // back to the SAME tab that sent it isn't something the sender should
  // have to wait on to see their own text land.
  async function sendMessage(trimmed: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("staff_messages")
      .insert({ channel_id: channelId, sender_id: myProfileId, body: trimmed })
      .select()
      .single();
    if (!error && data) {
      addMessage(data as Message);
    }
  }

  useImperativeHandle(ref, () => ({ send: sendMessage }), [channelId, myProfileId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    await sendMessage(trimmed);
  }

  // In the merged compose-pill (hideComposer), stay fully collapsed --
  // no "Loading..."/"No messages yet" placeholder taking up space -- until
  // there's an actual message to show.
  if (hideComposer && !loading && messages.length === 0) {
    return null;
  }

  const visibleMessages = latestOnly ? messages.slice(-1) : messages;

  if (latestOnly) {
    // Compact preview: just the latest message, sized to its own content,
    // no scroll container -- sits right above the compose row rather than
    // a tall scrolling history panel.
    return (
      <div className="px-4 pt-3">
        {visibleMessages.map((m) => {
          const mine = m.sender_id === myProfileId;
          return (
            <div key={m.id} className={mine ? "text-right" : ""}>
              {!mine && isGroup ? (
                <p className="mb-0.5 text-xs font-medium text-muted">{nameById.get(m.sender_id) ?? "Unknown"}</p>
              ) : null}
              <div
                className={`inline-block max-w-[70%] truncate rounded-[6px] px-3 py-1.5 text-sm ${
                  mine ? "bg-primary text-card" : "bg-accent/40 text-ink"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          hideComposer ? null : <p className="text-sm text-muted">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.sender_id === myProfileId;
              return (
                <div key={m.id} className={mine ? "text-right" : ""}>
                  {!mine && isGroup ? (
                    <p className="mb-0.5 text-xs font-medium text-muted">
                      {nameById.get(m.sender_id) ?? "Unknown"}
                    </p>
                  ) : null}
                  <div
                    className={`inline-block max-w-[85%] rounded-[6px] px-3 py-2 text-sm ${
                      mine ? "bg-primary text-card" : "bg-accent/40 text-ink"
                    }`}
                  >
                    {m.body}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {hideComposer ? null : (
        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message"
            className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-card"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
});
