# Spec: Command Center — belongs in Connect, not Connect Hub

Written 22 Aug 2026, for Claude Code. Moves the "command center" concept out of the
standalone Connect Hub tool and into main Connect proper, where it can actually work.

## Decision

The command center (cross-product revenue/accounts view for Ramy, the platform owner) is
**not a Connect Hub screen**. It should be a route inside the main Connect app
(`ramysakr1-ux/celta-connect`), gated by an owner-only role on Ramy's account — same
login, same domain, no second username/password. A mockup was built as
`7_ramy_command_center.html` in the Connect Hub design project; treat it as the visual
reference only, not something to port as-is (it currently lives among Connect Hub's static
files and should not stay there).

## Why it belongs in Connect

- Connect already has real auth and a real database. A route gated by an owner role can
  query Connect's own account/billing tables directly for real numbers — no telemetry
  layer needed for Connect's own data specifically.
- Connect Hub and Affina are separate apps/domains and still can't be queried directly —
  they'd need to report their own usage/billing facts to somewhere this route can read
  from (a small shared events/billing table, or an API each product calls). That's a
  separate, smaller piece of work from where the page lives.
- Avoids building and maintaining a second, disconnected "command center" specific to
  Connect Hub — one screen, inside the product with the real backend, covers it.

## What to build

1. **Route + role**: a new route (e.g. `/admin/command-center` or similar, Code's call to
   match existing route conventions) visible only to accounts flagged with an owner role —
   never to centre admins, tutors, or trainees.
2. **Connect's own data, wired for real**: active accounts/centres, MRR, renewals due,
   outstanding invoices — pulled from Connect's actual tables. This part can be fully live
   from day one.
3. **Connect Hub / Affina data, placeholder until those products report in**: same visual
   slots (per-product breakdown cards, unified accounts table) but marked as illustrative
   until each product has a way to report usage/billing facts somewhere this route can read.
4. **Payments**: no provider connected yet anywhere in this ecosystem. Leave a disabled
   "Connect payment provider" affordance, matching the mockup, until Stripe (or equivalent)
   is actually wired — that's its own scoped piece of work (webhooks, checkout, invoice
   automation), not part of this route's build.

## Reference

- `7_ramy_command_center.html` (visual reference: KPI strip, per-product cards with a
  dashed "add the next product" card, unified accounts table, activity feed, payments
  section) — build against this design, adapting styling to Connect's existing design
  system rather than copying the raw HTML.

## Not in scope for this spec

- Actually wiring Stripe or any payment provider.
- Building the events/billing-reporting mechanism for Connect Hub and Affina to feed this
  route (needed before their numbers can be real — flag as a following piece of work).
