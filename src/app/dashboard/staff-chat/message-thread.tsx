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
  { channelId, myProfileId, nameById, isGroup, hideComposer = false, staticMessages },
  ref
) {
  const [messages, setMessages] = useState<Message[]>(staticMessages ?? []);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(!staticMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // build-spec.md §8 bug 1 -- scrollIntoView on a sentinel div can scroll
  // the whole PAGE, not just this panel, if the panel isn't the nearest
  // scrolling ancestor. Setting scrollTop directly on the panel's own
  // scroll container never touches anything outside it.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden" role="log" aria-live="polite">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          hideComposer ? null : <p className="text-sm text-muted">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.sender_id === myProfileId;
              return (
                <div key={m.id} className="flex items-start gap-2.5">
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center rounded-[8px] text-[9px] font-semibold ${
                      mine ? "bg-gold text-gold-foreground" : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {(mine ? "Me" : (nameById.get(m.sender_id) ?? "?")).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-1.5 text-xs font-semibold text-ink">
                      {!mine && isGroup ? (nameById.get(m.sender_id) ?? "Unknown") : mine ? "You" : null}
                      <span className="text-[10px] font-normal text-muted">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                    <p className="text-[13px] leading-[1.45] text-ink/85 text-pretty">{m.body}</p>
                  </div>
                </div>
              );
            })}
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
