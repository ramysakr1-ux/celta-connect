import "server-only";

// The visual shell every Connect email sits in, from `spec.md` /
// `full-email-specs.md`: a card on a warm ground, 6px radius, a 3px coloured
// top spine marking the category, subject-weight heading, body at 13-14px,
// a filled CTA in the category accent, and a footnote in small muted type.
//
// Tables, not divs. Outlook renders flexbox and modern CSS unpredictably, and
// an email that collapses in Outlook is not a styling problem -- it is a
// candidate who cannot find the link to the course they have paid for.
// Everything is inline: <style> blocks are stripped by several clients,
// Gmail included in some contexts.
//
// The palette is the handoff's, not the app's tokens -- an email cannot read
// CSS custom properties, and no mail client supports oklch, so these are
// literals on purpose.
//
// Every value is a COMPUTED conversion of the spec's own oklch, not an
// eyeballed approximation -- e.g. teal oklch(37.5% 0.058 195) -> #0f4a4b,
// gold oklch(63% 0.096 72) -> #ad7f43. If the spec's oklch changes, recompute
// rather than nudge the hex by hand.

export const EMAIL_TONE = {
  /**
   * Setup and informational, and the app's actual accent colour -- teal.
   *
   * Fixed on the 2026-08-21 colour-legend pass: `teal`, `gold`, and `green`
   * had all silently pointed at gold's own hex (#ad7f43) since 2026-08-16,
   * a workaround for the fact that the handoff's teal oklch(37.5% 0.058 195)
   * converts to #0f4a4b, which reads as dark green on screen in most mail
   * clients -- and green was ruled out of the palette that day. Rather than
   * leave every "teal" email actually rendering gold, this uses a distinct,
   * clearly-teal (not green) mid-dark shade instead.
   *
   * This is the colour on the spine and the buttons of the interview
   * invitation, the offer, the acceptance and the workspace invitation, so it
   * is the one that was actually being looked at.
   */
  teal: "#1a5c5e",
  /** Waiting, time-limited, warm. Gold is otherwise reserved for the brand
   * mark and top-achievement grade markers -- this is the canonical gold hex
   * already used by this codebase's PDF generators, kept distinct from
   * `teal` and `amber` below. */
  gold: "#a97a2f",
  /** Rejection, flag. */
  red: "#972622",
  /**
   * Confirmation, positive. Green is fully retired from this project's
   * colour legend, so a `green`-toned email now means the same thing as
   * `teal` -- same hex, kept as its own name only so call sites can still
   * say "this is a confirmation" rather than "this is teal/positive".
   */
  green: "#1a5c5e",
  /**
   * Advisory / pending -- waiting-list emails. Split out from `gold` on the
   * 2026-08-21 pass: those emails are semantically amber (needs-attention),
   * not gold (which is reserved), so they get their own print/email-safe
   * amber hex distinct from both `teal` and `gold`.
   */
  amber: "#8a6116",
  /** Plain acknowledgements, nothing to signal. */
  muted: "#6d655c",
  /**
   * The sober one, for the rejections and "the course filled before a place
   * came free".
   *
   * Applications.dc.html leaves these with no accent at all -- the card's own
   * near-white border. Ramy overrode that on 2026-08-16: every email carries a
   * coloured line, because a set where some have one and some don't reads as a
   * mistake rather than as restraint.
   *
   * So this is the warm muted brown rather than teal or gold. It is visibly a
   * line, which is what was asked for, without a bright bar celebrating at
   * someone who has just been turned down.
   */
  plain: "#6d655c",
} as const;

export type EmailTone = keyof typeof EMAIL_TONE;

const GROUND = "#eae6dd";
const CARD = "#fcf7ed"; // --color-card, oklch(97.8% 0.014 85)
const INK = "#241d16";
const MUTED = "#6d655c";
const BORDER = "#e0dcd4";

/** One "Facts" row -- the label/value pairs under the body. */
export interface EmailFact {
  label: string;
  value: string;
}

export interface EmailShellInput {
  /** Shown large at the top of the card. Distinct from the subject line. */
  heading: string;
  /** Already-escaped HTML paragraphs. */
  body: string;
  tone?: EmailTone;
  facts?: EmailFact[];
  cta?: { label: string; url: string; note?: string };
  /** Small print at the bottom, inside the card. */
  footnote?: string;
  /** Ramy, 25 Aug 2026: a real link, not escaped text -- "if they don't
   *  want to be notified in the email, they can just disable it in the
   *  email itself." Renders as its own small line below the footnote. */
  unsubscribeUrl?: string;
}

/**
 * Escapes text destined for an email body.
 *
 * Every template runs candidate-supplied values through this: a name is
 * whatever the applicant typed into a public form, and it lands in HTML we
 * send on the centre's behalf.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A paragraph in body copy. Escapes its content. */
export function p(text: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${INK};">${esc(text)}</p>`;
}

/** A paragraph that may contain already-built inline markup (e.g. <strong>). */
export function rawP(html: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${INK};">${html}</p>`;
}

/** A bulleted list. Escapes each item. */
export function list(items: string[]): string {
  if (!items.length) return "";
  const li = items
    .map((i) => `<li style="margin:0 0 6px;font-size:14px;line-height:1.55;color:${INK};">${esc(i)}</li>`)
    .join("");
  return `<ul style="margin:0 0 12px;padding-left:20px;">${li}</ul>`;
}

/**
 * A button inside the body, with its own caption beneath.
 *
 * Course Emails.dc.html interleaves these mid-flow rather than closing with
 * one: the acceptance email puts "Pay the deposit" after the fee paragraph
 * and "Set up your Connect account" several paragraphs later, each with its
 * own sub-line. That sequencing is the message -- pay first, then the other
 * two things, "and neither is urgent" -- so it cannot be flattened into a
 * single trailing CTA without rewriting what the email says.
 */
export function inlineButton(input: { label: string; url: string; sub?: string; tone?: EmailTone }): string {
  const accent = EMAIL_TONE[input.tone ?? "teal"];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 6px;">
      <tr><td style="border-radius:6px;background:${accent};">
        <a href="${input.url}" style="display:inline-block;padding:10px 20px;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(input.label)}</a>
      </td></tr>
    </table>
    ${input.sub ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.55;color:${MUTED};">${esc(input.sub)}</p>` : ""}`;
}

/** A signature block -- "Nazlı Aydın\nCourse Director" renders as two lines. */
export function signature(name: string, role?: string): string {
  return `<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:${INK};">${esc(name)}${
    role ? `<br /><span style="color:${MUTED};">${esc(role)}</span>` : ""
  }</p>`;
}

export function emailShell(input: EmailShellInput): string {
  const accent = EMAIL_TONE[input.tone ?? "teal"];

  const facts = input.facts?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:4px 0 18px;border-top:1px solid ${BORDER};">
         ${input.facts
           .map(
             (f) => `<tr>
               <td style="padding:9px 12px 9px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;
                          text-transform:uppercase;color:${MUTED};white-space:nowrap;vertical-align:top;
                          border-bottom:1px solid ${BORDER};">${esc(f.label)}</td>
               <td style="padding:9px 0;font-size:13.5px;line-height:1.5;color:${INK};
                          border-bottom:1px solid ${BORDER};">${esc(f.value)}</td>
             </tr>`
           )
           .join("")}
       </table>`
    : "";

  const cta = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 14px;">
         <tr><td style="border-radius:6px;background:${accent};">
           <a href="${input.cta.url}"
              style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;
                     color:#ffffff;text-decoration:none;border-radius:6px;">${esc(input.cta.label)}</a>
         </td></tr>
       </table>
       ${
         input.cta.note
           ? `<p style="margin:0 0 14px;font-size:12px;line-height:1.55;color:${MUTED};">${esc(input.cta.note)}</p>`
           : ""
       }
       <!-- The button is a link, but some clients strip the styling entirely.
            Repeating the URL as text means the address is always reachable. -->
       <p style="margin:0 0 14px;font-size:11.5px;line-height:1.5;color:${MUTED};">
         If the button doesn't work, use this address:<br />
         <a href="${input.cta.url}" style="color:${accent};">${esc(input.cta.url)}</a>
       </p>`
    : "";

  const footnote = input.footnote
    ? `<p style="margin:16px 0 0;padding-top:14px;border-top:1px solid ${BORDER};
                 font-size:11.5px;line-height:1.55;color:${MUTED};">${esc(input.footnote)}</p>`
    : "";

  const unsubscribe = input.unsubscribeUrl
    ? `<p style="margin:${input.footnote ? "8px" : "16px"} 0 0;${input.footnote ? "" : `padding-top:14px;border-top:1px solid ${BORDER};`}
                 font-size:11.5px;line-height:1.55;color:${MUTED};">
         <a href="${input.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">Stop these class reminders</a>
       </p>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:${GROUND};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${GROUND};">
    <tr><td align="center" style="padding:28px 14px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="max-width:560px;background:${CARD};border:1px solid ${BORDER};border-radius:6px;">
        <!-- The 3px category spine. The only colour-coding device in the set. -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${accent};border-radius:6px 6px 0 0;">&nbsp;</td></tr>
        <tr><td style="padding:26px 28px 24px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:20px;
                     line-height:1.3;font-weight:600;color:${INK};">${esc(input.heading)}</h1>
          ${input.body}
          ${facts}
          ${cta}
          ${footnote}
          ${unsubscribe}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// for-claude-code-signin-and-email-branding.md: the shared shell for
// Connect's own auth-adjacent emails (sign-in link, trainee/tutor invite,
// assessor link, password reset) -- distinct from emailShell()'s spine
// system above, which is the wider admissions/course email family (offer,
// acceptance, rejection, etc.) this spec doesn't touch. Centre-branded
// header (ink-brown bar, centre name in gold italic serif) matching the
// in-app header treatment, rather than a coloured top spine.
//
// Hex values are computed conversions of Sign-in Cards and Emails.dc.html's
// own oklch (canvas 2D rasterization, not eyeballed) -- same rule
// emailShell() above follows for its own palette.
const AUTH_INK_BROWN = "#3e2818"; // oklch(30% 0.042 58)
const AUTH_GOLD = "#aa732b"; // oklch(60% 0.11 70)

export interface AuthEmailShellInput {
  centerName: string;
  heading: string;
  /** Already-escaped HTML paragraphs -- same convention as emailShell(). */
  body: string;
  facts?: EmailFact[];
  cta: { label: string; url: string; note?: string };
  footnote?: string;
}

export function authEmailShell(input: AuthEmailShellInput): string {
  const facts = input.facts?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:4px 0 18px;border-top:1px solid ${BORDER};">
         ${input.facts
           .map(
             (f) => `<tr>
               <td style="padding:9px 12px 9px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;
                          text-transform:uppercase;color:${MUTED};white-space:nowrap;vertical-align:top;
                          border-bottom:1px solid ${BORDER};">${esc(f.label)}</td>
               <td style="padding:9px 0;font-size:13.5px;line-height:1.5;color:${INK};
                          border-bottom:1px solid ${BORDER};">${esc(f.value)}</td>
             </tr>`
           )
           .join("")}
       </table>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:${GROUND};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${GROUND};">
    <tr><td align="center" style="padding:28px 14px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${AUTH_INK_BROWN};padding:18px 26px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:19px;color:${AUTH_GOLD};">${esc(input.centerName)}</div>
        </td></tr>
        <tr><td style="padding:28px 26px;">
          <h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;color:${INK};">${esc(input.heading)}</h2>
          ${input.body}
          ${facts}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;">
            <tr><td style="border-radius:6px;background:${AUTH_INK_BROWN};">
              <a href="${input.cta.url}" style="display:inline-block;padding:11px 22px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(input.cta.label)} &rarr;</a>
            </td></tr>
          </table>
          ${input.cta.note ? `<p style="margin:8px 0 0;font-size:11.5px;line-height:1.5;color:${MUTED};">${esc(input.cta.note)}</p>` : ""}
          <p style="margin:14px 0 0;font-size:11.5px;line-height:1.5;color:${MUTED};">
            If the button doesn't work, use this address:<br />
            <a href="${input.cta.url}" style="color:${AUTH_INK_BROWN};">${esc(input.cta.url)}</a>
          </p>
          ${input.footnote ? `<p style="margin:18px 0 0;font-size:11px;line-height:1.55;color:${MUTED};">${esc(input.footnote)}</p>` : ""}
        </td></tr>
      </table>
      <p style="margin:8px 4px 0;max-width:520px;font-size:11px;color:${MUTED};">Sent from ${esc(input.centerName)}'s own address, not a generic Connect no-reply.</p>
    </td></tr>
  </table>
</body></html>`;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://celtaconnect.com";

// Ramy, 25 Aug 2026: "I wouldn't mind the center name but connect sort of
// logo there... connect logo on top." Applied once, centrally, in
// sendApplicantEmail (admissions-email.ts) rather than threaded into each
// of the ~24 individual xEmailHtml template functions and every one of
// their call sites -- same reasoning already behind that function's own
// subject-line centre-name prefix, right next to where this is called.
// Works on anything either shell above produced: both always emit the
// exact centering <td> matched below. authEmailShell already shows the
// centre name prominently in its own branded header bar, so only
// emailShell's plain <h1> output (never a <h2>) gets the extra eyebrow
// line -- otherwise the name would appear twice, a few pixels apart.
export function withConnectBranding(html: string, centerName: string): string {
  // Ramy, 26 Aug 2026: "the Connect logo is too big for something that's
  // supposed to be coming from the centre -- it should be the centre
  // really, name, and Connect just a smaller logo on top." Shrunk from a
  // 20px icon / 13px wordmark to a small signature rather than a second
  // header competing with the centre's own eyebrow line below it.
  const logo = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:5px;"><img src="${SITE_URL}/icon-192.png" width="13" height="13" alt="Connect" style="display:block;border-radius:3px;" /></td>
          <td style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:10px;color:${MUTED};">Connect</td>
        </tr></table>
      </td></tr>
    </table>`;

  const withLogo = html.replace(
    '<td align="center" style="padding:28px 14px 40px;">',
    `<td align="center" style="padding:28px 14px 40px;">${logo}`
  );

  if (!withLogo.includes("<h1")) return withLogo;
  const eyebrow = `<p style="margin:0 0 5px;font-size:10.5px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};">${esc(centerName)}</p>`;
  return withLogo.replace(/<h1[^>]*>/, (match) => `${eyebrow}${match}`);
}
