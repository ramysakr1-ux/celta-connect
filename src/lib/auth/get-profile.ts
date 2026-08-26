import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// React's per-request memoization -- every layout+page pair under
// /dashboard, /centre, /portfolio/[traineeId], /trainer/(hub) (and every
// requireRole() call, which wraps this) independently calls this on the
// same navigation, each paying 2 round trips (auth.getUser + profile
// select). Wrapping in cache() means the second+ call within one request
// reuses the first result instead of re-querying -- same data, same
// security posture (still a real, fresh check on every new request), just
// not re-fetched twice for one page load. Confirmed duplicate calls in
// centre/dashboard/portfolio/trainer layout+page pairs before this fix.
export const getCurrentProfile = cache(async (): Promise<{
  userId: string;
  email: string | undefined;
  profile: Profile | null;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, email: user.email, profile: profile ?? null };
});
