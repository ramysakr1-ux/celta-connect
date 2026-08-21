"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Message = Database["public"]["Tables"]["filmed_observation_messages"]["Row"];

// Same shape as staff chat's MessageThread (client-side fetch + realtime
// INSERT subscription, local optimistic append on send) -- this chat
// persists with the session and is visible read-only to anyone rewatching
// solo later, so there's no separate "live-only" mode to build.
export function FilmedObservationChat({
  sessionId,
  myProfileId,
  nameById,
  initialMessages,
}: {
  sessionId: string;
  myProfileId: string;
  nameById: Map<string, string>;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  function addMessage(m: Message) {
    setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev : [...prev, m]));
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`filmed_observation_messages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "filmed_observation_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => addMessage(payload.new as Message)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function sendMessage(trimmed: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("filmed_observation_messages")
      .insert({ session_id: sessionId, author_id: myProfileId, body: trimmed })
      .select()
      .single();
    if (!error && data) addMessage(data as Message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    await sendMessage(trimmed);
  }

  return (
    <div className="flex h-full flex-col rounded-[10px] border border-border bg-card">
      <p className="border-b border-border px-3.5 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Group chat</p>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-2.5" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.map((m) => {
              const mine = m.author_id === myProfileId;
              return (
                <div key={m.id} className="flex items-start gap-2">
                  <div
                    className={`flex size-5 shrink-0 items-center justify-center rounded-[7px] text-[8px] font-semibold ${
                      mine ? "bg-surface-muted text-ink" : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {(mine ? "Me" : (nameById.get(m.author_id) ?? "?")).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-1.5 text-[11px] font-semibold text-ink">
                      {mine ? "You" : (nameById.get(m.author_id) ?? "Unknown")}
                      <span className="text-[10px] font-normal text-muted">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                    <p className="text-[12.5px] leading-[1.45] text-ink/85 text-pretty">{m.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-1.5 border-t border-border p-2.5">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          className="flex-1 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-ink outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground">
          Send
        </button>
      </form>
    </div>
  );
}
