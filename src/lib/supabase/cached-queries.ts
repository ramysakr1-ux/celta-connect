import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Cross-request caching (unlike React's cache(), which only dedupes within
// one request) for reference data that's centre-admin-configured and
// changes on the order of "once, ever" -- not per-request. A centre's
// name/logo/is_demo flag/number is exactly this shape: found (2026-08-26
// perf investigation) being re-fetched from scratch on every single
// trainer-hub and portfolio page load, even though it's the same handful
// of rows for the entire deployment's lifetime. 1 hour is generous
// staleness tolerance for data like this; if a centre's name/logo is
// edited, the old value can legitimately linger for up to an hour rather
// than needing an immediate cache-bust wired up for a change this rare.
export const getCachedCenter = unstable_cache(
  async (centerId: string) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("centers")
      .select("id, name, logo_url, is_demo, center_number, application_low_availability_threshold, is_uk_centre")
      .eq("id", centerId)
      .maybeSingle();
    return data;
  },
  ["center-by-id"],
  { revalidate: 3600 }
);

// The one real (is_demo: false) centre -- used by /apply and the landing
// page. Its own cache key/tag so it doesn't collide with the by-id variant
// above; same 1-hour staleness tolerance.
export const getCachedRealCenter = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("centers")
      .select("id, name, logo_url, is_demo, center_number, application_low_availability_threshold, is_uk_centre")
      .eq("is_demo", false)
      .limit(1)
      .maybeSingle();
    return data;
  },
  ["center-real-one"],
  { revalidate: 3600 }
);
