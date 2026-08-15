import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AdminChatCourse {
  courseId: string;
  courseName: string;
  channelId: string;
}

// "Administrators can chat with each other, keyed by course, not by
// person" -- one course_admin channel per course (migration 0092),
// membership synced to every admin at the centre automatically. This is
// entirely separate from the trainer-only staff chat -- no trainer is ever
// a member of these channels, and no admin is ever a member of the
// trainer-only ones. Only ever returns channels this admin is actually a
// member of, same RLS-respecting shape as getInitialStaffChatData.
export async function getAdminChatCourses(profileId: string): Promise<AdminChatCourse[]> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("staff_channel_members")
    .select("channel_id")
    .eq("profile_id", profileId);
  const channelIds = (memberships ?? []).map((m) => m.channel_id);
  if (channelIds.length === 0) return [];

  const { data: channels } = await supabase
    .from("staff_channels")
    .select("id, course_id, name")
    .in("id", channelIds)
    .eq("type", "course_admin");

  return (channels ?? [])
    .filter((c): c is typeof c & { course_id: string } => c.course_id !== null)
    .map((c) => ({ courseId: c.course_id, courseName: c.name ?? "Untitled course", channelId: c.id }))
    .sort((a, b) => a.courseName.localeCompare(b.courseName));
}
