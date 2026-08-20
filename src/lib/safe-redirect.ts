// A `next` destination carried through login/magic-link redirects must stay
// same-origin -- accepting an arbitrary query-param URL here is a classic
// open-redirect (a phishing link to the real login page that lands the
// victim somewhere attacker-controlled right after they authenticate).
// Requires exactly one leading slash: "/foo" is fine, "//evil.com" (browsers
// treat this as protocol-relative) and "https://evil.com" are not.
export function safeRedirectPath(next: string | null | undefined, fallback: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}
