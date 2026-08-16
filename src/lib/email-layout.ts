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
  /** Setup and informational. */
  teal: "#0f4a4b",
  /** Waiting, time-limited, warm. */
  gold: "#ad7f43",
  /** Rejection, flag. */
  red: "#972622",
  /**
   * Confirmation, positive. Brass, not green (Ramy, 2026-08-16) -- the green
   * is out of the palette, here as everywhere else. Same value as gold; kept
   * as its own name so an email can still say "this is a confirmation" rather
   * than "this is time-limited", even though they now look alike.
   */
  green: "#ad7f43",
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
const CARD = "#fefcf9";
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
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
