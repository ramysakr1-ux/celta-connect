import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface RecentChange {
  label: string;
  createdAt: string;
}

// Under-specified in the spec (two words, "'What changed' notes panel," no
// further detail on either the admin-home or per-course sidebar it sits
// on) -- built as a reasonable minimal reading: recent additions to the
// shared centre material the same sidebar already counts (TP points
// library, assignment briefs, resource hub, feedback style examples,
// coursebooks), most recent first. Not a full audit log or diff view --
// just enough to answer "has anything changed since I last looked."
export async function getRecentCentreChanges(centerId: string, limit = 6): Promise<RecentChange[]> {
  const supabase = await createClient();

  const [{ data: briefs }, { data: resources }, { data: coursebooks }, { data: styleExamples }] = await Promise.all([
    supabase
      .from("assignment_templates")
      .select("assignment_type, created_at")
      .eq("center_id", centerId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("resources")
      .select("title, created_at")
      .eq("center_id", centerId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("tp_coursebooks")
      .select("title, created_at")
      .eq("center_id", centerId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("feedback_style_examples")
      .select("tone, created_at")
      .eq("center_id", centerId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const changes: RecentChange[] = [
    ...(briefs ?? []).map((b) => ({ label: `Assignment brief updated: ${b.assignment_type}`, createdAt: b.created_at })),
    ...(resources ?? []).map((r) => ({ label: `Resource added: ${r.title}`, createdAt: r.created_at })),
    ...(coursebooks ?? []).map((c) => ({ label: `Coursebook added: ${c.title}`, createdAt: c.created_at })),
    ...(styleExamples ?? []).map((s) => ({ label: `Feedback style example added (${s.tone})`, createdAt: s.created_at })),
  ];

  return changes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
