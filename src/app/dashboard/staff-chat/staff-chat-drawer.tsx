"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageThread } from "@/app/dashboard/staff-chat/message-thread";
import type { ChannelSummary, Coworker } from "@/lib/staff-chat";

const CHANNEL_TYPE_LABEL: Record<ChannelSummary["type"], string> = {
  center_trainers: "Group",
  all_staff: "Group",
  dm: "Direct message",
};

export function StaffChatDrawer({
  profileId,
  initialChannels,
  coworkers,
}: {
  profileId: string;
  initialChannels: ChannelSummary[];
  coworkers: Coworker[];
}) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState(initialChannels);
  const [selectedId, setSelectedId] = useState<string | null>(initialChannels[0]?.id ?? null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [startingDm, setStartingDm] = useState(false);

  const selected = channels.find((c) => c.id === selectedId) ?? null;

  async function startDm(coworker: Coworker) {
    setStartingDm(true);
    const supabase = createClient();
    const { data: channelId, error } = await supabase.rpc("get_or_create_dm_channel", {
      other_profile_id: coworker.id,
    });
    setStartingDm(false);
    setShowNewMessage(false);

    if (error || !channelId) return;

    setChannels((prev) =>
      prev.some((c) => c.id === channelId)
        ? prev
        : [...prev, { id: channelId, type: "dm", name: coworker.full_name }]
    );
    setSelectedId(channelId);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-primary px-5 py-3 text-sm font-medium text-card"
      >
        {open ? "Close chat" : "Staff chat"}
      </button>

      {open ? (
        <div className="fixed bottom-24 right-6 z-30 flex h-[70vh] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-[6px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-serif text-ink">Staff chat</p>
            <button
              type="button"
              onClick={() => setShowNewMessage((v) => !v)}
              className="text-sm text-primary hover:underline"
            >
              New message
            </button>
          </div>

          {showNewMessage ? (
            <div className="border-b border-border p-3">
              <p className="mb-2 text-xs text-muted">Message a coworker</p>
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {coworkers.length === 0 ? (
                  <p className="text-sm text-muted">No other staff at your center yet.</p>
                ) : (
                  coworkers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={startingDm}
                      onClick={() => startDm(c)}
                      className="rounded-[6px] px-2 py-1.5 text-left text-sm text-ink hover:bg-background disabled:opacity-60"
                    >
                      {c.full_name}{" "}
                      <span className="text-xs capitalize text-muted">({c.role})</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-1 overflow-hidden">
            <div className="w-32 shrink-0 overflow-y-auto border-r border-border">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    c.id === selectedId ? "bg-background text-ink" : "text-muted"
                  }`}
                >
                  <span className="block truncate">{c.name}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-muted">
                    {CHANNEL_TYPE_LABEL[c.type]}
                  </span>
                </button>
              ))}
              {channels.length === 0 ? (
                <p className="p-3 text-xs text-muted">No channels yet.</p>
              ) : null}
            </div>

            {selected ? (
              <MessageThread
                key={selected.id}
                channelId={selected.id}
                channelName={selected.name}
                myProfileId={profileId}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-4">
                <p className="text-sm text-muted">Select a channel.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
