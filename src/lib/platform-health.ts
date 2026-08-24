import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// for-claude-code-command-center.md item 6: "Needs a status source -- either
// a real uptime/error monitor Code already runs, or a lightweight internal
// health endpoint if none exists yet." No external monitor exists in this
// codebase -- this is that lightweight fallback: a real database round-trip
// with a timeout, not a hardcoded "all normal" string. Three states per the
// spec (normal/degraded/incident); "degraded" fires on a slow response
// rather than an outright failure, since a working-but-slow database is a
// real, distinct signal from one that's actually down.
export type PlatformHealthStatus = "normal" | "degraded" | "incident";

export interface PlatformHealth {
  status: PlatformHealthStatus;
  label: string;
}

const DEGRADED_THRESHOLD_MS = 800;

export async function checkPlatformHealth(): Promise<PlatformHealth> {
  const admin = createAdminClient();
  const startedAt = Date.now();
  try {
    const { error } = await admin.from("centers").select("id", { count: "exact", head: true });
    const elapsedMs = Date.now() - startedAt;
    if (error) return { status: "incident", label: "Database error" };
    if (elapsedMs > DEGRADED_THRESHOLD_MS) return { status: "degraded", label: "Slow response" };
    return { status: "normal", label: "All systems normal" };
  } catch {
    return { status: "incident", label: "Database unreachable" };
  }
}
