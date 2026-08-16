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
    // /demo mints a fresh session for the seeded demo trainer and redirects
    // through /auth/confirm -- inherently unauthenticated, same reasoning.
    request.nextUrl.pathname === "/demo" ||
    // /apply is the public, centre-branded admissions application page --
    // inherently unauthenticated, same reasoning as /join/[token].
    request.nextUrl.pathname === "/apply" ||
    // /offer/[token] is the offer-acceptance link -- inherently
    // unauthenticated, same reasoning as /join/[token].
    request.nextUrl.pathname.startsWith("/offer/") ||
    // /forgot-password is how a logged-out user requests a reset link --
    // inherently unauthenticated, same as /login.
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    // The getting-started guide is linked from the staff invitation email, and
    // "the recipient has no account yet when they see it, so it must stand
    // alone with no app around it" -- gating it behind login would make the
    // link in that email bounce off a sign-in wall.
    request.nextUrl.pathname.startsWith("/getting-started") ||
    // Tokenized no-login links (course_access_tokens, migration 0030) --
    // volunteer students, the admissions register link, and assessors never
    // get a real Supabase session at all, so these must stay reachable
    // without one. Each route validates its own token server-side.
    request.nextUrl.pathname.startsWith("/student/") ||
    request.nextUrl.pathname.startsWith("/register/") ||
    request.nextUrl.pathname.startsWith("/assessor/") ||
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
    request.nextUrl.pathname.startsWith("/api/webhooks/");

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
  const isAssessorReachableRoute =
    hasAssessorCookie &&
    (request.nextUrl.pathname === "/assessor" ||
      request.nextUrl.pathname === "/trainer" ||
      request.nextUrl.pathname.startsWith("/trainer/") ||
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
