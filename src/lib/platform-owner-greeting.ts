import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCourseState } from "@/lib/course-progress";
import { toLocalIso } from "@/lib/timetable-grid";

// for-claude-code-role-tinted-backgrounds-v2-final.md's personal-greeting item,
// moved from /platform/command-center to /platform itself (Ramy, 22 Aug 2026:
// that's the actual landing page after login -- the welcome belongs on the
// first thing you see, not one click deeper). Shared here so both pages can
// use it without duplicating the subscription/invoice queries.
export interface PlatformOwnerGreeting {
  firstName: string;
  timeOfDay: "morning" | "afternoon" | "evening";
  dateEyebrow: string;
  recap: string;
}

export async function getPlatformOwnerGreeting(fullName: string | null): Promise<PlatformOwnerGreeting> {
  const admin = createAdminClient();
  const [{ data: courses }, { data: subscriptions }, { data: invoices }] = await Promise.all([
    admin.from("courses").select("center_id, start_date, end_date"),
    admin.from("centre_subscriptions").select("status, renewal_date"),
    admin.from("centre_invoices").select("status"),
  ]);

  const today = toLocalIso(new Date());
  const runningCentreIds = new Set(
    (courses ?? [])
      .filter((c) => computeCourseState(c.start_date, c.end_date, today) === "running")
      .map((c) => c.center_id)
  );

  const activeSubs = (subscriptions ?? []).filter((s) => s.status === "active");
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const renewalsDueThisWeek = activeSubs.filter((s) => s.renewal_date && new Date(s.renewal_date) <= in7Days);
  const outstandingCount = (invoices ?? []).filter((i) => i.status === "outstanding").length;

  const firstName = fullName?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const dateEyebrow = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

  const recapParts = [
    `${runningCentreIds.size} centre${runningCentreIds.size === 1 ? "" : "s"} running`,
    `${renewalsDueThisWeek.length} renewal${renewalsDueThisWeek.length === 1 ? "" : "s"} due this week`,
    outstandingCount ? `${outstandingCount} outstanding invoice${outstandingCount === 1 ? "" : "s"}` : "nothing needs you right now",
  ];

  return { firstName, timeOfDay, dateEyebrow, recap: recapParts.join(", ") + "." };
}
