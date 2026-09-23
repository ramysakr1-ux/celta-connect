/**
 * How long an assessor's link to the pack lasts.
 *
 * Ramy, 18 Sep 2026: "the link could expire with the migration of the files or
 * could expire with the termination of the course files on Connect ... they can
 * always access the centre". So the real end is close-out -- wipe.ts deletes
 * every course_access_tokens row for the course with the rest of the working
 * data, and the centre keeps the pack as PDFs, so nothing is lost when the link
 * goes. This is only a backstop for a course whose close-out never runs, where
 * a token would otherwise have no end at all.
 *
 * It lives here rather than beside the mint because the mint is in a
 * "use server" file, which a route or a page cannot import a constant from
 * without dragging the server actions along with it -- and the pack's own
 * header has to be able to state the same rule it is minted under. It said
 * "Link expires 18 Sept 2027" on the demo, a year out from whenever the token
 * happened to be created, contradicting the rule the same page cites
 * (walked 23 Sep 2026).
 */
export const ASSESSOR_LINK_BACKSTOP_DAYS = 90;

/** The backstop date for a course ending on `endDate` (a date-only column). */
export function assessorLinkBackstop(endDate: string): Date {
  return new Date(new Date(`${endDate}T00:00:00`).getTime() + ASSESSOR_LINK_BACKSTOP_DAYS * 86400000);
}
