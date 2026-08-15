# Rename: Connect CELTA → Connect

Written 7 Aug 2026. Apply across `ramysakr1-ux/celta-connect`. This is a **branding change only** — no routes, data, or behaviour change. Do it in one pass before further feature work, so nothing new is written against the old name.

## Why

CELTA is a registered trademark of Cambridge University Press & Assessment. Using it *descriptively* ("a platform for CELTA centres") is defensible; using it *as the product name*, in the logo, on a platform rented to other centres, implies endorsement. The cost of renaming grows with every centre onboarded, so it happens now.

**CELTA may still appear** in body copy, descriptors, page titles and documentation, as plain description — "Built for CELTA and Delta centres", "CELTA 5 record", "CELTA syllabus criteria". Cambridge's own document names (CELTA 5, CELTA Administration Handbook) are used verbatim and stay.

## The name

- Product name: **Connect**
- Descriptor, used wherever the name appears cold: **Teacher training platform**
- Never: "Connect CELTA", "CELTA Connect", "connectcelta".

## The mark

**Completely unchanged** — same geometry, same stroke weight, same colours as the current `wordmark.tsx`. Two open C arcs, openings right, second offset +40px x, stroke-width 11 at r=24, round caps.

Only its *meaning* changes: it no longer stands for "CELTA + Connect", it reads as two points linking — which is the word itself. Better justified than before, and nothing to redraw.

```svg
<svg viewBox="8 30 104 60" fill="none">
  <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8"
        stroke="var(--color-gold)" stroke-width="11" stroke-linecap="round"/>
  <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8"
        stroke="var(--color-ink)" stroke-width="11" stroke-linecap="round"/>
</svg>
```

Size compensation, as today: below 40px wide use stroke-width 13; below 24px use 15. Gold arc always first/left.

## The wordmark — tile lockup

**Locked 7 Aug 2026** — including the email-header sizes and the 9px descriptor floor. Every decision below is settled; build it exactly as written.

Replaces the two-word lockup in `src/components/wordmark.tsx`. **The mark now always sits inside a filled ink tile**, which is what makes the gold work at every size: gold-on-ink is strong where gold-on-cream is not.

**Tile.** Square, `background: var(--color-ink-warm)` — **a new token, `oklch(30% 0.042 58)`**, a warm dark brown one step lighter and warmer than `--color-ink`. This is the tile colour everywhere, and it is also used for headings, primary buttons and ticked checkboxes on entry surfaces (sign-in, invitations, consent gates) so those screens read as one temperature rather than black type on cream. Body text stays `--color-ink`. Radius ≈ 0.22 × side. Mark centred inside at ≈ 0.63 × the tile width. Inside the tile the arcs invert: first arc `oklch(70% 0.12 72)` (lifted gold, for contrast), second arc `var(--color-card)`.

**Word.** "Connect", Instrument Serif, *italic*, **gold** (`--color-gold`), `line-height: 0.85`, `letter-spacing: -0.012em`. Font-size ≈ 0.56 × the tile side.

**Descriptor.** "Teacher training platform" — **one line, never two.** Instrument Sans 600, uppercase, `letter-spacing: 0.26em` (0.24em below 40px word size), `--color-muted`. Font-size ≈ 0.20 × the word size, **with a hard floor of 9px — never smaller.** If the ratio would put it under 9px, enlarge the whole lockup instead, or drop the descriptor entirely; sub-9px uppercase tracked type on cream is texture, not text, and email clients render it worse than a browser does. **`padding-left: 9px`** at the reference size (44px word) so the T sits under the C's stem rather than its overhang — scale that offset with the word. At this tracking the descriptor runs almost exactly the width of "Connect", forming a rule under it; that relationship is the point of the lockup and two lines destroys it.

**Spacing.** Tile-to-text gap 15px at the 78px tile, `align-items: center`. Word-to-descriptor gap 7px.

**Reversed** (whole lockup on ink): tile becomes `oklch(30% 0.02 65)` — one step lighter than the ground so it still reads as a tile — arcs unchanged, word `oklch(70% 0.12 72)`.

**The spin stays, but slower.** The existing `wordmark-spin` animation carries over with one change: **duration goes from 54s to 90s**, everywhere — one number, not per-context. Everything else is unchanged — `rotateY(0deg)` held from 0% to 11.11% on the readable face, then through to 360deg; `perspective: 400px` on the `.wordmark-mark-stage` parent; `transform-style: preserve-3d`; disabled under `prefers-reduced-motion`. At 90s the hold on the readable face lasts 10 seconds and the turn reads as drift rather than animation: visible if you glance at it, quiet if you do not. Slower than this stops being worth the battery cost on every screen.

**The tile does not move.** Apply `.wordmark-spin` to the `<svg>` inside the tile, never to the tile itself, and put `.wordmark-mark-stage` on the tile so the perspective origin sits with the square. The arcs turn inside a static box.

Static everywhere motion is impossible or unwanted: certificates, exported PDFs, email templates, favicon, and any print surface.

**Sizes**
| Context | Tile | Word | Descriptor |
|---|---|---|---|
| Sign-in, certificate, marketing | 78–92px | 44–54px | yes |
| App header | 34px | 22px | no |
| Stacked (narrow, portrait) | 54px | 27px | yes, may break to two lines here only |
| Email header | 44px | 26px | yes, 9px |
| Favicon / avatar / touch icon | 22–48px | — | — |

The tile alone **is** the app icon: same square for favicon, avatar and phone home screen. Increase the mark's stroke-width as the tile shrinks (11 at 78px, 13 at 34px, 15 at 22px) so the arcs hold their weight — the same compensation already used today.

Where the descriptor appears: sign-in, **invitation emails**, certificates, the assessor pack cover, marketing. Where it does not: the app header, favicon, avatar tile, or any context where the user already knows what they are in.

## The domain

The platform runs on **`celtaconnect.com`**, which Ramy owns. The product is called **Connect**; the domain is a legacy address, not the brand. This is deliberate — one-word `.com` domains with "connect" are unavailable or priced absurdly, and the domain is visible in only three places (the address bar, the link in emails, the sender address).

To keep the brand and the address from fighting:

- **Emails send with the display name `Connect`**, never "CELTA Connect". The underlying address may be `noreply@celtaconnect.com`; almost nobody reads it.
- **Email subject lines lead with the centre**, not the platform — e.g. `ITI Istanbul · your CELTA workspace is ready`. The centre is what the recipient recognises; Connect is the tool underneath.
- Nothing in the UI, page titles, metadata or copy spells the domain out as a brand. It is an address only.
- Later, optionally: **a subdomain per centre** (`iti.celtaconnect.com`), so a centre's people see their own name in the address and the platform recedes. Design `SITE_DOMAIN` handling so this is possible without a rewrite.

## Find and replace

Search the whole repo, including `public/`, email templates, migrations' seed text, and metadata:

| Old | New |
|---|---|
| `Connect CELTA` / `CELTA Connect` | `Connect` |
| `connectcelta.app` | `celtaconnect.com` — **the domain stays**, see "The domain" below. Extract it to a single constant (`SITE_DOMAIN`) if hardcoded in more than one place. |
| `celta-connect` (package name, repo refs) | leave the repo name; change `package.json` `name` to `connect` |
| Page titles `… | Connect CELTA` | `… | Connect` |
| `<title>`, `og:site_name`, manifest `name`/`short_name` | `Connect` |
| Email `from` display name | `Connect` |
| Favicon / touch icon | regenerate from the 8-unit mark |

**Do not replace** CELTA where it names a Cambridge artefact or requirement: `CELTA 5`, `CELTA Administration Handbook`, `CELTA syllabus`, `celta5` table and column names, `CELTA_CRITERIA` constants, grade descriptor text. Renaming those breaks the correspondence with Cambridge's own documents, which is the whole point of the app.

## Copy that changes meaning, not just words

Three strings currently lean on the old name and need rewriting rather than substituting:

1. Sign-in page subtitle — was implicitly "the CELTA platform", briefly **"Teacher training platform. Built for CELTA and Delta centres."** **Removed 2026-08-15**: sign-in card no longer carries brand/tagline copy at all, per Ramy's explicit ask to de-emphasize "Connect" branding on the actual sign-in screen — just a small muted wordmark and a plain "Sign in" heading now.
2. Invitation email — subject leads with the **centre**, e.g. `ITI Istanbul · your CELTA workspace is ready`. Sender display name is the **centre's own name** (revised 2026-08-15, see "Checks" below — was `Connect`). The body opens with the centre and course, not the platform; the platform appears only as the wordmark at the top.
3. Certificate and report footers — the mark plus "Connect" in plain text; no descriptor, no strapline.

## Checks

- No occurrence of "Connect CELTA" or "CELTA Connect" anywhere, including alt text, aria-labels, and email subject lines.
- Every remaining "CELTA" refers to a Cambridge artefact, a course, or a qualification — never to this product.
- Favicon and app icon regenerated at the new stroke weight.
- `Wordmark` renders correctly at all four sizes in the table above, with the tile's stroke-width compensation applied.
- Gold appears in exactly two places in the identity: the word, and the first arc inside the tile. Nowhere else picks up gold as decoration.
- Email sender display name is the **sending centre's own name**, never `Connect` or "CELTA
  Connect" — **revised 2026-08-15**, supersedes the original "sender display name is Connect"
  rule below. Nobody should notice "Connect" as a brand at all; the recipient should recognise
  their own centre's name in their inbox, not the platform underneath it. `joinLinkSender()` in
  `src/lib/resend/client.ts` is the one place this is implemented — falls back to "Connect" only
  when no centre is resolvable (e.g. a sign-in link sent to an email with no matching account).

## Designer credit — REMOVED 2026-08-15

Dropped entirely, not relocated. Originally a single line ("[mark, 20px] Connect · designed and
built by Ramy") on the Centre Admin + sign-in footers, then narrowed to the public landing page
footer only earlier the same day — then the landing page itself was removed (root `/` now
redirects straight to `/login`, nobody signs up through the bare domain) and Ramy confirmed he'd
rather drop the credit than find it a new home. `src/components/designer-credit.tsx` deleted.
