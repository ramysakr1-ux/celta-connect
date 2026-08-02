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
    request.nextUrl.pathname.startsWith("/forgot-password");

  if (!user && !isPublicRoute) {
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
