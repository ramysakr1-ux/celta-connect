# Payment provider connection — spec for Claude Code

Written 16 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Payments.dc.html`, screen `1c`. Reached from Centre Admin's Centre settings ("payment providers" link, see `Centre Admin.dc.html` footer bar).

## What this is
A Centre settings screen letting a centre connect its own payment provider account, so card payment becomes available as one of four accepted methods (bank transfer, cash, card, employer/sponsor invoice). Card is optional, never required.

## The model (already established elsewhere — this screen is the UI for it)
- Connect never holds or moves money — no wallet, no balance, no payout logic.
- Connect never stores or transmits card numbers, bank details, or any PCI-scope data.
- The centre connects **its own** provider account. Connect stores only a reference to each transaction.
- Design behind a generic "payment provider" interface (webhook receiver + status-mapping layer) so swapping providers doesn't touch the rest of the app.
- Once connected, the acceptance email's Pay-deposit link routes to that provider's hosted page; the provider confirms; the pipeline stage flips itself. Card payments show "Confirmed" (provider-verified); every other method shows "Marked by [name]."
- One currency per course, set by the centre.

## Layout
Card (`oklch(99.2% 0.005 90)` bg, 1px border `oklch(88% 0.016 82)`, 10px radius, 20px padding) containing:
1. **Provider list** — one row per option, each showing a colored status dot + provider name + region/notes, in a bordered pill row. Options: Stripe (Global), iyzico (Turkey — cards, instalments), PayTR (Turkey), Mollie (Europe), Adyen (Global). Clicking a row selects it — selected row gets a teal border + faint teal tint background; this highlight is the only "current selection" indicator (no separate summary box above the list).
2. Divider, then a line of copy: connecting redirects to the provider's own onboarding (KYC included) — this screen only wires the acceptance email's Pay link to that account, it doesn't process anything itself.
3. Primary button: "Connect [Provider name]" — teal fill, full width, 40px tall.
4. Footer note below the card: one currency per course; card is one of four methods, never required.

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (primary/selected) `oklch(38% 0.072 195)`, card `oklch(99.2% 0.005 90)`, border `oklch(88% 0.016 82)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings). Provider dots are decorative brand-adjacent colors, not semantic.

## Behavior notes for build
- Selecting a provider is local UI state in the prototype; real build should persist the centre's chosen provider and gate the "Connect" button behind actual OAuth/API-key onboarding for that provider.
- Only one provider can be connected at a time per centre (switching providers is a deliberate re-connect, not a multi-provider setup).
- This screen doesn't process any payment — it only establishes the connection consumed later by the acceptance-email Pay link and the Payments ledger (`Payments.dc.html` screen `1a`).
