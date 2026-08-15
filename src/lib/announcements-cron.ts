import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toLocalIso } from "@/lib/timetable-grid";

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// for-claude-code-trainer-remaining-screens.md's Announcements screen:
// "Scheduled ... announcements written once and fired automatically by
// the timetable." Runs daily, bundled into the existing admissions-
// waiting-list cron slot -- the Hobby plan's 2-cron/day cap is already
// spent by course-close-out-wipe + that route (see its own comment).
export async function runAnnouncementsFireCron(): Promise<{ fired: number }> {
  const supabase = createAdminClient();
  const today = toLocalIso(new Date());

  const { data: pending } = await supabase
    .from("course_broadcasts")
    .select("id, anchor_event_id, anchor_offset_days")
    .is("sent_at", null)
    .not("anchor_event_id", "is", null);

  const anchorEventIds = [...new Set((pending ?? []).map((p) => p.anchor_event_id).filter((id): id is string => !!id))];
  const { data: anchorEvents } =
    anchorEventIds.length > 0
      ? await supabase.from("course_timetable_events").select("id, event_date").in("id", anchorEventIds)
      : { data: [] };
  const eventDateById = new Map((anchorEvents ?? []).map((e) => [e.id, e.event_date]));

  const dueIds = (pending ?? [])
    .filter((row) => {
      const eventDate = row.anchor_event_id ? eventDateById.get(row.anchor_event_id) : null;
      if (!eventDate || row.anchor_offset_days === null) return false;
      const fireDate = addDays(eventDate, row.anchor_offset_days);
      return fireDate <= today;
    })
    .map((row) => row.id);

  if (dueIds.length === 0) return { fired: 0 };

  await supabase.from("course_broadcasts").update({ sent_at: new Date().toISOString() }).in("id", dueIds);
  return { fired: dueIds.length };
}
