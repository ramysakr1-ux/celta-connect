# Payments — provider bridge, not a payment processor (supersedes the old "payment is outside the app" decision)

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Payments.dc.html`.

**This overrides the comment in `src/app/dashboard/admissions/actions.ts` dated the same day** ("Payment is outside the app, deliberately... confirmed over Ramy's own handover, 2026-08-14"). That comment reflected an earlier same-day conversation that has since been revisited — this spec is the final word: build the provider bridge described below, not manual-only.

## The decision this replaces

`specs/build-spec.md` currently says payment is entirely outside the app: an admin manually ticks "fee paid" with a free-text note, and Connect never touches money. That rule is **refined, not fully reversed**: Connect still never handles money directly — no card data, no holding funds, no bank connection of its own. What changes is that Connect can be **linked to a third-party payment provider** (Stripe is the natural fit given the instalment/invoicing needs below) purely as a **status bridge**: the provider processes the actual charge, and Connect automatically reflects what the provider reports, instead of requiring an admin to manually flip a switch for every online payment.

## The model

Every payment record has a **source**, and the source determines how its status gets set:

- **Provider** (card payments, online instalments) — status updates **automatically** via the provider's webhook/API. Connect never sees card details, only transaction events (paid, instalment N of M paid, instalment missed, refunded). Shown in the UI as "Confirmed — the provider said so."
- **Manually marked by [admin name]** — cash, bank transfer, employer invoice, anything that happens outside the connected provider. An admin enters this by hand, same as the old model, with a free-text reference note.

Both sources coexist in one list — a centre doesn't have to pick one method for everyone; different applicants/candidates can pay differently in the same cohort.

## Instalments

- A payment can be split into a plan (e.g. 3 instalments) at setup, tracked per-instalment.
- **A missed instalment is not an automatic consequence** (no auto-suspension, no auto-email) — it becomes a **payments task** that sits until a human acts on it. Automation stops at "tell someone," never escalates to "do something about it" on its own.

## What Connect must never do

- Never store or transmit card numbers, bank details, or any PCI-scope data — that's entirely on the provider's hosted checkout/invoice flow.
- Never hold or move funds itself — no wallet, no balance, no payout logic.
- Never require a specific provider — design the integration behind a generic "payment provider" interface (webhook receiver + a small status-mapping layer) so swapping Stripe for another provider later doesn't touch the UI or the payments-task logic.

## Build

- A `payment_provider_transactions` (or similar) table keyed to the applicant/candidate + course, populated by webhook events from the connected provider: status, instalment index (if applicable), amount, provider transaction id, timestamp.
- A `payments` view/table unifying provider-sourced and manually-marked rows into the one list the UI shows (source, status, amount, who/what marked it, reference note for manual entries).
- A background job or webhook handler that turns "instalment missed" events into a task in whatever task system already exists elsewhere in the app (same pattern as other admin tasks — a bounce, a resubmission needed, etc.), not a bespoke one-off mechanism.
