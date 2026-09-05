"use client";

import { HUB_BUTTON } from "@/app/trainer/(hub)/page-head";

import { useState } from "react";
import { getOrCreateRegisterViewToken } from "@/app/trainer/(hub)/volunteers/actions";

export function RegisterLinkButton() {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setMessage(null);
    const { token, error } = await getOrCreateRegisterViewToken();
    if (error || !token) {
      setState("error");
      setMessage(error ?? "Could not create the link.");
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/register/${token}`);
    setState("copied");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "loading"}
        title="Copies a read-only link to the attendance register for someone who is not a tutor -- centre staff, the assessor"
        className={`${HUB_BUTTON} disabled:opacity-60`}
      >
        {state === "loading" ? "Getting link…" : state === "copied" ? "Link copied" : "Share register view"}
      </button>
      {message ? <p className="max-w-[260px] text-right text-[11px] text-destructive">{message}</p> : null}
    </div>
  );
}
