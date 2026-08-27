import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminChatRoom {
  channelId: string;
  name: string;
  centerId: string;
}

/**
 * build-spec.md §12: the admin channel is "**Centre-scoped, not
 * course-scoped.** Members: centre owner, centre admins, centre manager,
 * course admins. No tutors, no candidates." Named after the centre, so nobody
 * assumes a message reaches tutors.
 *
 * This replaces the course-scoped version (migration 0091), which gave an admin
 * one room per course. §13 rejects that: an admin covering two cities "is
 * having one conversation."
 *
 * The trainer-only rule is untouched. This channel reaches into no course, and
 * course channels never appear in an admin's picker -- §10 is absolute, "course
 * chat is absent from every admin role, including centre owner. No exception,
 * ever."
 *
 * Membership is derived from centre_roles rather than stored, so appointing
 * someone puts them in the room and revoking takes them out, with no separate
 * list to fall out of step. The room is created on first use.
 */
export async function getAdminChatRooms(profileId: string, centerIds: string[]): Promise<AdminChatRoom[]> {
  if (centerIds.length === 0) return [];

  const admin = createAdminClient();

  // Ramy, 27 Aug 2026: these two didn't depend on each other (both only
  // need centerIds), and the per-centre insert+upsert loop below ran each
  // centre's round trips one after another -- for a single-centre account
  // (the common case) that's one extra sequential stage on every /centre
  // navigation, and for a multi-centre account (yours) it multiplied by
  // centre count. Both fixed to run concurrently.
  const [{ data: centres }, { data: existing }] = await Promise.all([
    admin.from("centers").select("id, name").in("id", centerIds),
    admin.from("staff_channels").select("id, center_id, name").eq("type", "centre_admin").in("center_id", centerIds),
  ]);

  const byCentre = new Map((existing ?? []).map((c) => [c.center_id, c]));

  const rooms = await Promise.all(
    (centres ?? []).map(async (centre) => {
      // "Named after the centre, not a course" -- ITI Istanbul · admin.
      const name = `${centre.name} · admin`;
      let channel = byCentre.get(centre.id);

      if (!channel) {
        const { data: created } = await admin
          .from("staff_channels")
          .insert({ center_id: centre.id, type: "centre_admin", name })
          .select("id, center_id, name")
          .single();
        if (!created) return null;
        channel = created;
      }

      // Membership follows the grant. Idempotent, so this is safe to run on
      // every load and self-heals if someone was appointed while away.
      await admin
        .from("staff_channel_members")
        .upsert({ channel_id: channel.id, profile_id: profileId }, { onConflict: "channel_id,profile_id" });

      return { channelId: channel.id, name: channel.name ?? name, centerId: centre.id };
    })
  );

  return rooms.filter((r): r is AdminChatRoom => r !== null).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether this person may post in the admin room.
 *
 * Everyone in the admin family can, including the Centre observer (the
 * centre_manager slug, renamed 2026-08-23) -- §12: "The centre manager can
 * post here, despite being read-only everywhere else. Being unable to ask a
 * question is a strange kind of read-only." That is the one deliberate
 * exception to their absent-buttons treatment.
 */
export function canPostInAdminChat(roleCount: number): boolean {
  return roleCount > 0;
}

export interface AdminChatCourse {
  courseId: string;
  courseName: string;
  channelId: string;
}

/** Kept so existing callers compile while the course-scoped bar is replaced. */
export async function getAdminChatCourses(profileId: string): Promise<AdminChatCourse[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("staff_channel_members").select("channel_id").eq("profile_id", profileId);
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
