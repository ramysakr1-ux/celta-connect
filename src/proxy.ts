import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session cookie if expired. Required for Server Components,
  // which can only read cookies, not write them.
  //
  // Ramy, 27 Aug 2026: tried switching this to getClaims() (local JWT
  // verification, same fix as get-profile.ts below) to avoid getUser()'s
  // network round trip -- measured live via Vercel's request logs and it
  // was a WASH here: this proxy's execution context doesn't seem to keep
  // getClaims()'s JWKS cache warm between requests the way the main
  // function does, so it ended up calling out to
  // /auth/v1/.well-known/jwks.json on every request anyway, and that call
  // measured slower (360-500ms) than getUser()'s own auth/v1/user call
  // (~215ms). Reverted to getUser() here specifically -- proven, not worse.
  // The real, confirmed win was removing get-profile.ts's SECOND,
  // redundant auth check that ran on top of this one; that's real and
  // stays.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    isAuthRoute ||
    // /auth/confirm verifies a token_hash server-side and has no session
    // yet when the request arrives -- inherently unauthenticated.
    request.nextUrl.pathname.startsWith("/auth/confirm") ||
    // /auth/set-password: by the time this is reached, /auth/confirm has
    // already set the session cookie on the redirect response, but keep it
    // in the public allowlist defensively -- the page itself still gates on
    // having a real session and redirects to /login if not.
    request.nextUrl.pathname.startsWith("/auth/set-password") ||
    // /join/[token] is the self-serve course join link -- inherently
    // unauthenticated, that's the whole point.
    request.nextUrl.pathname.startsWith("/join/") ||
    // /demo is the five-entry-point landing page; /demo/<role> mints a
    // fresh session for a seeded demo account and redirects through
    // /auth/confirm (or, for the volunteer, straight to a token link) --
    // inherently unauthenticated, same reasoning. Prefix match, not an
    // exact one, now that /demo has more than one route under it
    // (connect-multi-role-demo-spec-2026-08-22.md).
    request.nextUrl.pathname === "/demo" ||
    request.nextUrl.pathname.startsWith("/demo/") ||
    // /apply is the public, centre-branded admissions application page --
    // inherently unauthenticated, same reasoning as /join/[token].
    request.nextUrl.pathname === "/apply" ||
    // /offer/[token] is the offer-acceptance link -- inherently
    // unauthenticated, same reasoning as /join/[token].
    request.nextUrl.pathname.startsWith("/offer/") ||
    // /interview/[token] is the interview-slot picker, and is public for
    // exactly the same reason /offer/[token] is: an applicant has no
    // account, and the token IS the credential. It was missing from this
    // list, so every applicant clicking "book a time" from their invite
    // email was redirected to a login page they cannot use -- the page
    // itself never redirects, it renders its own "this link is invalid"
    // message, so nothing surfaced the cause. Found because
    // /demo/journey/interview was the one journey link still landing on
    // /login after everything else was fixed.
    request.nextUrl.pathname.startsWith("/interview/") ||
    // /forgot-password is how a logged-out user requests a reset link --
    // inherently unauthenticated, same as /login.
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    // The getting-started guide is linked from the staff invitation email, and
    // "the recipient has no account yet when they see it, so it must stand
    // alone with no app around it" -- gating it behind login would make the
    // link in that email bounce off a sign-in wall.
    request.nextUrl.pathname.startsWith("/getting-started") ||
    // Admin Handbook §6.3: the candidate agreement must be given to
    // candidates BEFORE the course starts -- so before most of them have an
    // account. Gating it behind login would make the one document Cambridge
    // names as a pre-course obligation unreachable at exactly the point it
    // is required. Same reasoning as /terms, which the signup checkboxes
    // already link to from an unauthenticated page.
    // Pre-existing bug, found 29 Aug 2026 while adding the line below:
    // /terms is the "full terms" link the join, offer-accept and
    // join-centre checkboxes all point at, and every one of those pages is
    // itself unauthenticated -- /join/[token], /offer/[token],
    // /join-centre/[token]. So a candidate ticking "I agree" and clicking
    // through to read what they were agreeing to hit a sign-in wall for an
    // account they did not have yet. Its own file comment describes it as
    // "the full-terms link promised by the join/offer-accept checkboxes",
    // so this was never intended to be gated.
    request.nextUrl.pathname.startsWith("/terms") ||
    request.nextUrl.pathname.startsWith("/candidate-agreement") ||
    // Tokenized no-login links (course_access_tokens, migration 0030) --
    // volunteer students, the admissions register link, and assessors never
    // get a real Supabase session at all, so these must stay reachable
    // without one. Each route validates its own token server-side.
    request.nextUrl.pathname.startsWith("/student/") ||
    request.nextUrl.pathname.startsWith("/register/") ||
    request.nextUrl.pathname.startsWith("/assessor/") ||
    // Platform support access (for-claude-code-platform-support-access.md)
    // -- support@ has no standing Supabase login at all, same reasoning as
    // the three tokenized links above. The token itself, checked live
    // against the grant's real expiry in resolveActiveGrantByToken, is the
    // only gate.
    request.nextUrl.pathname.startsWith("/support/") ||
    // Vercel Cron invokes this with no session cookie at all, just its own
    // Authorization: Bearer $CRON_SECRET header -- the route checks that
    // itself. Found live: without this, the redirect below fired before the
    // route's own auth check ever ran, so the grace-period wipe would have
    // silently never executed in production.
    request.nextUrl.pathname.startsWith("/api/cron/") ||
    // Same reasoning, same bug pattern: a payment provider's webhook (e.g.
    // Stripe) posts here with no session cookie either, just its own
    // signature header -- the route verifies that itself. Found live while
    // testing the payments bridge: without this, every webhook delivery
    // 307-redirected to /login before the route ever ran, so provider
    // status updates would have silently never applied in production.
    request.nextUrl.pathname.startsWith("/api/webhooks/") ||
    // The service worker and the web app manifest, which have to be
    // fetchable with no session at all.
    //
    // Found live, 30 Aug 2026, chasing why the install offer never
    // appeared: /sw.js was 307-redirecting to /login for anyone not signed
    // in. A service worker registration FAILS OUTRIGHT if the script
    // request redirects -- the spec forbids following one -- so volunteers,
    // who never have a Supabase session by design, have never had a
    // service worker registered at all.
    //
    // That silently took two features with it. Install was one. Push was
    // the other: the volunteer "Enable notifications" button registers this
    // exact file before subscribing, so a volunteer could never have
    // received the "your class starts in 30 minutes" reminder no matter how
    // correctly the VAPID keys and the cron were set up.
    //
    // The manifest is here for the same reason -- a manifest that redirects
    // to a login page is not a manifest, and Chrome silently drops the
    // install criteria when it cannot read one.
    request.nextUrl.pathname === "/sw.js" ||
    request.nextUrl.pathname === "/manifest.webmanifest";

  // An assessor carries no real Supabase user at all -- just the
  // assessor_token cookie set by /assessor/[token] (migration 0030). This
  // only checks the cookie is present, not that it's still valid/unexpired
  // -- full validation (getAssessorCourseId) happens at the page level via
  // the admin client, same division of labor as every other auth check in
  // this proxy, which also doesn't validate row-level authorization itself.
  const hasAssessorCookie = Boolean(request.cookies.get("assessor_token")?.value);
  // Real bug found and fixed while building checkpoint 9 (Assessor pack):
  // this used to require an EXACT match on "/trainer" -- which only ever
  // let an assessor through the landing bounce from /assessor/[token]
  // itself, then bounced them straight back to /login the moment they
  // navigated anywhere under it (/trainer/roster, /trainer/grades-report,
  // /trainer/volunteers, all real assessor-facing pages per rosterOnly).
  // Needs the whole /trainer/* subtree, same as /portfolio/ already gets.
  // for-claude-code-assessor-interface.md: the real dedicated single-screen
  // app now lives at bare /assessor (the token-entry route redirects here
  // after setting the cookie) -- distinct from /assessor/[token], which is
  // already public above since it's the unauthenticated entry point itself.
  //
  // Second instance of the same bug, found 29 Aug 2026: the trainer hub an
  // assessor is allowed to browse links straight into /dashboard --
  // assignment briefs, marking guidance, a candidate's CELTA 5 record --
  // and this list did not include it, so those links 307'd them to a login
  // they cannot use. Ramy: "once they're out, clicking on anything...
  // there's no way to go back." It is a dead end, not a permission
  // boundary: the pages themselves are the same read-only staff pages
  // already reachable under /trainer.
  const isAssessorReachableRoute =
    hasAssessorCookie &&
    (request.nextUrl.pathname === "/assessor" ||
      request.nextUrl.pathname === "/trainer" ||
      request.nextUrl.pathname.startsWith("/trainer/") ||
      request.nextUrl.pathname.startsWith("/dashboard/") ||
      request.nextUrl.pathname.startsWith("/portfolio/"));

  if (!user && !isPublicRoute && !isAssessorReachableRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
