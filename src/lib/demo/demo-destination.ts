import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * `?to=` on a /demo/<role> link: the screen to land on, instead of that
 * person's own landing page.
 *
 * Ramy, 18 Sep 2026, walking the Course Story: "everything goes somewhere
 * else... I can't click on any of them and it takes me where it's supposed
 * to." 130 of the story's 143 cards had no destination of their own, so each
 * one signed you in as its lane's person, pinned the day and dropped you on
 * their landing page -- right person, right day, wrong screen. The cards
 * could not say where they meant, because the demo links had nowhere to put
 * it.
 *
 * `{me}` stands for the signed-in profile's own id, so a card can point at
 * "/portfolio/{me}/tp/3" without hardcoding an id that changes every time
 * the demo is reseeded. mintDemoMagicLink already accepts a function of the
 * profile id for exactly this, so the substitution happens after the account
 * is resolved and never appears in a URL.
 *
 * Same-origin only, through safeRedirectPath -- a demo link is a public URL
 * that authenticates somebody, which is precisely the shape an open redirect
 * needs to be dangerous.
 */
export function demoDestination(
  raw: string | null | undefined,
  fallback: string | ((profileId: string) => string)
): string | ((profileId: string) => string) {
  if (!raw) return fallback;
  const path = safeRedirectPath(raw, "");
  if (!path) return fallback;
  if (!path.includes("{me}")) return path;
  return (profileId: string) => path.replaceAll("{me}", profileId);
}

/**
 * The token-based doors -- the assessor's pack and the volunteer's page --
 * have no session and no profile id. Their `?to=` is a path UNDER the token
 * root, so "/lesson-plans" becomes "/assessor/<token>/lesson-plans", and a
 * card can never point one of them at somebody else's room.
 */
export function demoTokenDestination(raw: string | null | undefined, root: string): string {
  const suffix = safeRedirectPath(raw, "");
  if (!suffix) return root;
  return `${root}${suffix}`;
}
