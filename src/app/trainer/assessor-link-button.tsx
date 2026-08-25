"use client";

import { useActionState, useState } from "react";
import { getOrCreateAssessorToken, sendAssessorInviteEmail, type SendAssessorEmailState } from "@/app/trainer/assessor-actions";

const initialEmailState: SendAssessorEmailState = { error: null, sent: false };

export function AssessorLinkButton() {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error" | "not_ready">("idle");
  const [issues, setIssues] = useState<string[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailState, emailAction, emailPending] = useActionState(sendAssessorInviteEmail, initialEmailState);

  async function handleClick() {
    setState("loading");
    const { token, error, readinessIssues } = await getOrCreateAssessorToken();
    if (readinessIssues && readinessIssues.length > 0) {
      setIssues(readinessIssues);
      setState("not_ready");
      return;
    }
    if (error || !token) {
      setState("error");
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/assessor/${token}`);
    setState("copied");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={state === "loading"}
          className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainer-hover-fill disabled:opacity-60"
        >
          {state === "loading"
            ? "Checking readiness…"
            : state === "copied"
              ? "Copied!"
              : state === "error"
                ? "Try again"
                : state === "not_ready"
                  ? "Not ready yet"
                  : "Share assessor link"}
        </button>
        {state === "not_ready" ? (
          <div className="absolute right-0 top-full z-10 mt-1.5 w-72 rounded-[6px] border border-border bg-card p-3 text-xs shadow-sm">
            <p className="font-semibold text-ink">Portfolios aren&apos;t complete yet:</p>
            <ul className="mt-1.5 flex flex-col gap-1 text-muted">
              {issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setState("idle")} className="mt-2 text-primary hover:underline">
              Close
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setEmailOpen((v) => !v)}
          className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink trainer-hover-fill"
        >
          Email the assessor
        </button>
        {emailOpen ? (
          <form
            action={emailAction}
            className="absolute right-0 top-full z-10 mt-1.5 w-72 rounded-[6px] border border-border bg-card p-3 shadow-sm"
          >
            {emailState.sent ? (
              <>
                <p className="text-sm font-semibold text-primary">Sent.</p>
                <button type="button" onClick={() => setEmailOpen(false)} className="mt-2 text-xs text-primary hover:underline">
                  Close
                </button>
              </>
            ) : (
              <>
                <label className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Assessor&apos;s email</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="assessor@cambridge.org"
                  className="mt-1.5 h-9 w-full rounded-[6px] border border-border bg-card px-2.5 text-sm text-ink outline-none focus:border-primary"
                />
                {emailState.error ? <p className="mt-1.5 text-xs text-destructive">{emailState.error}</p> : null}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={emailPending}
                    className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {emailPending ? "Sending…" : "Send"}
                  </button>
                  <button type="button" onClick={() => setEmailOpen(false)} className="text-xs text-muted hover:text-ink">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </form>
        ) : null}
      </div>
    </div>
  );
}
