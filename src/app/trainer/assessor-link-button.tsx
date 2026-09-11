"use client";

import { useActionState, useState } from "react";
import { getOrCreateAssessorToken, sendAssessorInviteEmail, type SendAssessorEmailState } from "@/app/trainer/assessor-actions";

const initialEmailState: SendAssessorEmailState = { error: null, sent: false };

// Ramy, 6 Sep 2026: "an enforced checklist... a warning that so and so is
// still missing, with a potential override." The 14.1 items that are not
// ready come up BEFORE the link is copied or the email sent, and can be
// overridden -- his standing rule that anything the system decides must be
// overridable, and the right call here because Cambridge's own deadline does
// not wait for a centre's paperwork.
export function AssessorLinkButton({ outstanding = [] }: { outstanding?: string[] }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error" | "not_ready" | "warn" | "manual">("idle");
  const [issues, setIssues] = useState<string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailState, emailAction, emailPending] = useActionState(sendAssessorInviteEmail, initialEmailState);

  async function handleClick(skipWarning = false) {
    // The 14.1 warning comes first and is advisory; the portfolio readiness
    // check below still refuses, because that one gates the assessor's own
    // page rather than the centre's paperwork.
    if (!skipWarning && outstanding.length > 0) {
      setState("warn");
      return;
    }
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
    const url = `${window.location.origin}/assessor/${token}`;
    // The clipboard can refuse -- no permission, an insecure context, a
    // document that is not focused (Safari, some embeds). This used to await
    // it bare, so a refusal left the button on "Checking readiness…" for
    // good, disabled, with the link minted and nowhere to see it (found 11
    // Sep 2026 walking the flow). Fall back to showing the link to copy by
    // hand: the point of the button is that the MCT ends up holding the link.
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setLink(url);
      setState("manual");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => handleClick()}
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
                  : state === "warn"
                    ? "Check first"
                    : state === "manual"
                      ? "Copy by hand"
                      : "Share assessor link"}
        </button>
        {state === "manual" && link ? (
          <div className="absolute right-0 top-full z-10 mt-1.5 w-80 rounded-[6px] border border-border bg-card p-3 text-xs shadow-sm">
            <p className="font-semibold text-ink">The link is ready, but the clipboard refused it.</p>
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Assessor link"
              className="mt-1.5 h-8 w-full rounded-[6px] border border-border bg-card-inset px-2 font-mono text-[11px] text-ink"
            />
            <p className="mt-1.5 text-muted">Select it and copy.</p>
            <button type="button" onClick={() => setState("idle")} className="mt-2 text-primary hover:underline">
              Close
            </button>
          </div>
        ) : null}
        {state === "warn" ? (
          <div className="absolute top-full right-0 z-10 mt-1.5 w-80 rounded-[6px] border border-border bg-card p-3 text-xs shadow-sm">
            <p className="font-semibold text-ink">
              {outstanding.length} thing{outstanding.length === 1 ? "" : "s"} on the Handbook&apos;s §14.1 list {outstanding.length === 1 ? "is" : "are"} not
              ready yet:
            </p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-muted">
              {outstanding.slice(0, 6).map((label) => (
                <li key={label}>{label}</li>
              ))}
              {outstanding.length > 6 ? <li>and {outstanding.length - 6} more</li> : null}
            </ul>
            <p className="mt-2 text-muted">
              You can share the link anyway &mdash; §14.1 wants the pack two to three days before the visit, and that
              deadline does not wait for the paperwork.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleClick(true)}
                className="rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold text-primary-foreground"
                style={{ background: "var(--hub-accent)" }}
              >
                Share anyway
              </button>
              <button type="button" onClick={() => setState("idle")} className="text-primary hover:underline">
                Not yet
              </button>
            </div>
          </div>
        ) : null}
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
