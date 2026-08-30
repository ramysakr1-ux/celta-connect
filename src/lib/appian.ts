// The Appian platform address, from the CELTA Appian User Guidelines' own
// access instructions:
//
//   "Once you have your login details you can use the following link to
//    access Appian: https://cambridget2.appiancloud.com/suite/"
//
// It is the same address for every centre -- what differs per centre is the
// login, not the URL. centers.appian_url exists so a centre can point at
// something else (a bookmark, an SSO wrapper, a future address), and it wins
// where it is set.
//
// This exists as a fallback because the alternative was worse. Every place
// that linked to Appian was gated on centers.appian_url, and that column is
// null on both real centres -- so an assessor or an MCT who went looking for
// the link found a "not set" message instead. Ramy, 30 Aug 2026: "I don't
// see the Appian link, assessor or the MCT view." A link that is right for
// every centre should not be withheld because nobody filled in a field.
export const APPIAN_PLATFORM_URL = "https://cambridget2.appiancloud.com/suite/";

/** The centre's own Appian address where it has one, else the platform's. */
export function appianHref(centreUrl: string | null | undefined): string {
  return centreUrl?.trim() || APPIAN_PLATFORM_URL;
}
