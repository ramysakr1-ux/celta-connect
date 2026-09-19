import "server-only";
import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Stops a demo door from silently taking a real person's session.
 *
 * Every /demo/<role> link signs you in for real, and an installed Connect
 * shares Chrome's cookies with the ordinary tabs. So Ramy clicked one card on
 * the Course Story, became Diane Okonkwo, and his own app icon started
 * opening her centre-owner screen instead of his Command Center (18 Sep
 * 2026). He asked for the demo to open in incognito or another profile,
 * which no web page can do -- Chrome blocks it, and rightly, or any site
 * could step outside your session.
 *
 * What a page CAN do is ask first. Somebody signed in to a real centre gets
 * one screen before the swap, with the link to copy into a private window.
 * A visitor who is already on the demo centre, or signed in to nothing at
 * all, never sees it -- the demo has to stay one click for the people it is
 * for.
 */
export async function demoWouldReplaceRealSession(request: Request): Promise<NextResponse | null> {
  const url = new URL(request.url);
  // Coming back from the interstitial, having said yes.
  if (url.searchParams.get("confirm") === "1") return null;

  let profile;
  try {
    profile = (await getCurrentProfile())?.profile;
  } catch {
    return null;
  }
  if (!profile?.center_id) return null; // nobody signed in: nothing to lose

  const { data: centre } = await createAdminClient()
    .from("centers")
    .select("is_demo, name")
    .eq("id", profile.center_id)
    .maybeSingle();
  if (centre?.is_demo) return null; // already in the demo: no real session at stake

  const next = new URL(url.toString());
  next.searchParams.set("confirm", "1");
  const to = new URL("/demo/switch", url.origin);
  to.searchParams.set("next", `${next.pathname}${next.search}`);
  to.searchParams.set("name", profile.full_name ?? "your account");
  if (centre?.name) to.searchParams.set("centre", centre.name);
  return NextResponse.redirect(to);
}

/**
 * The two token doors (assessor, volunteer) mint a cookie rather than a
 * magic link, so unlike the other demo doors nothing replaced the real
 * session: the interstitial said "this signs you out of your own account"
 * and then did not. Signed in as a centre owner elsewhere, the assessor pack
 * opened but every candidate card 404'd -- the portfolio saw a real viewer,
 * read through that viewer's RLS, and found no such trainee (assessor walk,
 * 20 Sep 2026). Local scope: this browser's cookies only, not the person's
 * other devices.
 */
export async function dropRealSession(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.auth.signOut({ scope: "local" });
  } catch {
    // No session to drop, or cookies not writable here: the door still opens.
  }
}
