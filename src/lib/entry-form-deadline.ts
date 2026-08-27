import type { Database } from "@/lib/supabase/types";

type DeliveryMode = Database["public"]["Tables"]["courses"]["Row"]["delivery_mode"];

// Handbook 4.1 / build-spec.md §9: "Course dates to Cambridge four weeks
// ahead (Moodle) or two weeks (other) -- derive from start date and mode."
// "Moodle" means online input (course-modes.md: online courses deliver
// input "online via Moodle and/or centre platform"); a mixed course still
// has its TP location on-site (mode is defined by TP location per
// Handbook 3.3, not input location, per for-claude-code-course-admin.md),
// so it follows f2f's two-week rule here, not online's four.
const MOODLE_LEAD_DAYS = 28;
const OTHER_LEAD_DAYS = 14;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function computeEntryFormDeadline(startDate: string, deliveryMode: DeliveryMode): string {
  const leadDays = deliveryMode === "online" ? MOODLE_LEAD_DAYS : OTHER_LEAD_DAYS;
  return addDays(startDate, -leadDays);
}
