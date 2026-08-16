import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Area, AreaHolder } from "@/lib/auth/areas";

/**
 * Who holds each area in this centre. Read through the admin client because
 * this is displayed to everyone -- "areas never hide information" -- and the
 * join to profiles for a name would otherwise depend on a second policy
 * agreeing about a person the viewer may not otherwise be able to read.
 */
export async function getAreaHolders(centerId: string): Promise<Map<Area, AreaHolder>> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows } = await admin
    .from("centre_areas")
    .select("area, profile_id, ends_at")
    .eq("center_id", centerId)
    .is("revoked_at", null);

  // A temporary handover lapses on its own rather than needing anyone to
  // remember -- that's the whole reason ends_at exists.
  const live = (rows ?? []).filter((r) => !r.ends_at || r.ends_at >= today);
  if (live.length === 0) return new Map();

  const { data: people } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", live.map((r) => r.profile_id));
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return new Map(
    live.map((r) => [
      r.area as Area,
      { area: r.area as Area, profileId: r.profile_id, name: nameOf.get(r.profile_id) ?? "Someone", endsAt: r.ends_at },
    ])
  );
}

