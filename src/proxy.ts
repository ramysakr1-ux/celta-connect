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
    // /forgot-password is how a logged-out user requests a reset link --
    // inherently unauthenticated, same as /login.
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    // Tokenized no-login links (course_access_tokens, migration 0030) --
    // volunteer students, the admissions register link, and assessors never
    // get a real Supabase session at all, so these must stay reachable
    // without one. Each route validates its own token server-side.
    request.nextUrl.pathname.startsWith("/student/") ||
    request.nextUrl.pathname.startsWith("/register/") ||
    request.nextUrl.pathname.startsWith("/assessor/");

  // An assessor carries no real Supabase user at all -- just the
  // assessor_token cookie set by /assessor/[token] (migration 0030). This
  // only checks the cookie is present, not that it's still valid/unexpired
  // -- full validation (getAssessorCourseId) happens at the page level via
  // the admin client, same division of labor as every other auth check in
  // this proxy, which also doesn't validate row-level authorization itself.
  const hasAssessorCookie = Boolean(request.cookies.get("assessor_token")?.value);
  const isAssessorReachableRoute =
    hasAssessorCookie &&
    (request.nextUrl.pathname === "/trainer" || request.nextUrl.pathname.startsWith("/portfolio/"));

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
