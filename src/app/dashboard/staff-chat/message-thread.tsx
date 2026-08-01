"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Message = Database["public"]["Tables"]["staff_messages"]["Row"];

export function MessageThread({
  channelId,
  channelName,
  myProfileId,
}: {
  channelId: string;
  channelName: string;
  myProfileId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("staff_messages")
      .select("*")
      .eq("channel_id", channelId)
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
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");

    const supabase = createClient();
    await supabase
      .from("staff_messages")
      .insert({ channel_id: channelId, sender_id: myProfileId, body: trimmed });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-ink">{channelName}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className={m.sender_id === myProfileId ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[85%] rounded-[6px] px-3 py-2 text-sm ${
                    m.sender_id === myProfileId
                      ? "bg-primary text-card"
                      : "border border-border text-ink"
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
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          className="flex-1 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-[6px] bg-primary px-3 py-2 text-sm font-medium text-card"
        >
          Send
        </button>
      </form>
    </div>
  );
}
