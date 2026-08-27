"use client";

import { useActionState, useState } from "react";
import { connectProvider, disconnectProvider, type ConnectProviderState } from "@/app/centre/payments/actions";
import { PAYMENT_PROVIDERS, providerByKey, type PaymentProviderKey } from "@/lib/payments/providers";

const initial: ConnectProviderState = {};

// Spec's layout: one row per provider inside a bordered card, each with a
// coloured dot, name and region/notes. Clicking selects; the selected row's
// teal border and faint teal tint is the ONLY current-selection indicator --
// no separate summary box above the list.
export function ProviderList({
  connectedKey,
  connectedAt,
  credentialsPresent,
}: {
  connectedKey: PaymentProviderKey | null;
  connectedAt: string | null;
  /** Whether the server actually holds usable credentials for the connected
   *  provider. A green light that ignored this would say "working" about a
   *  provider whose first real checkout would throw. */
  credentialsPresent: boolean;
}) {
  const [selected, setSelected] = useState<PaymentProviderKey>(connectedKey ?? "stripe");
  const [state, action, pending] = useActionState(connectProvider, initial);
  const [disconnectState, disconnectAction, disconnecting] = useActionState(disconnectProvider, initial);

  const chosen = PAYMENT_PROVIDERS.find((p) => p.key === selected)!;
  const isConnected = connectedKey === selected && Boolean(connectedAt);

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-2">
        {PAYMENT_PROVIDERS.map((p) => {
          const active = p.key === selected;
          const live = p.key === connectedKey && Boolean(connectedAt);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected(p.key)}
              className={`admin-hover flex items-center gap-3 rounded-[8px] border px-4 py-3 text-left ${
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.dot }} aria-hidden="true" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-ink">{p.name}</span>
                <span className="block text-xs text-muted">
                  {p.region} — {p.note}
                </span>
              </span>
              {/* Status light. Green only when this provider would genuinely
                  take a payment right now; red when it is chosen but would
                  fail, so "selected" is never mistaken for "working". */}
              {p.key === connectedKey ? (
                live && credentialsPresent ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                    Working
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-destructive">
                    <span className="size-2 rounded-full bg-destructive" aria-hidden="true" />
                    {live ? "Not working" : "Not connected"}
                  </span>
                )
              ) : !p.adapter ? (
                <span className="shrink-0 text-[11px] text-muted">No integration yet</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border-faint pt-4">
        {connectedKey && !(connectedAt && credentialsPresent) ? (
          <p className="mb-3 rounded-[6px] border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-ink">
            {providerByKey(connectedKey)?.name} is selected but not working
            {connectedAt ? ", because Connect holds no credentials for it on the server" : ", because onboarding was never completed"}
            . Card payment is unavailable; bank transfer, cash and invoice are unaffected.
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-muted">
          Connecting redirects you to {chosen.name}&apos;s own onboarding, including their identity checks. This screen
          only wires the acceptance email&apos;s Pay link to that account — Connect never processes a payment, holds
          money, or sees a card number.
        </p>

        {isConnected ? (
          <form action={disconnectAction} className="mt-3 flex flex-col gap-2">
            <button
              type="submit"
              disabled={disconnecting}
              className="admin-hover-fill h-10 w-full rounded-[6px] border border-border bg-card text-sm font-semibold text-ink hover:border-destructive hover:text-destructive disabled:opacity-60"
            >
              {disconnecting ? "Disconnecting..." : `Disconnect ${chosen.name}`}
            </button>
          </form>
        ) : (
          <form action={action} className="mt-3">
            <input type="hidden" name="provider" value={selected} />
            <button
              type="submit"
              disabled={pending}
              className="admin-hover-fill h-10 w-full rounded-[6px] bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Connecting..." : `Connect ${chosen.name}`}
            </button>
          </form>
        )}

        {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
        {state.notice ? <p className="mt-2 text-sm text-ink">{state.notice}</p> : null}
        {disconnectState.notice ? <p className="mt-2 text-sm text-ink">{disconnectState.notice}</p> : null}
      </div>
    </div>
  );
}
