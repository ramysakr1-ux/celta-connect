import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { lettersForGroup } from "@/lib/tp-letters";
import { classLessons } from "@/lib/volunteer-class-session";

export interface ClassTeacher {
  name: string;
  topic: string | null;
}

interface DayEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  detail?: string | null;
  linked_tp_number: number | null;
  tp_group_scope_id: string | null;
}

/** The letter a TP card carries, e.g. "TP5 · C" -> "C". */
function letterOf(title: string): string | null {
  const m = /·\s*([A-F])\s*$/.exec(title.trim());
  return m ? m[1] : null;
}

/**
 * Who is teaching this volunteer's class on this day.
 *
 * The volunteer's page promises "no candidate names beyond who is teaching
 * them that day", and then named every candidate on the course: it asked
 * plan_assignments for everyone holding that TP number, which on a course
 * of twelve is twelve people across two groups and two levels (walked
 * 15 Sep 2026 -- eleven names joined by "and").
 *
 * Their class that day is three lettered lessons at their own level. Each
 * card carries its group (tp_group_scope_id) and its letter, and a group's
 * letters are its own A-F in base-slot order (tp-letters.ts), so the three
 * lessons resolve to exactly three candidates.
 */
export async function teachersForClassDay(
  admin: SupabaseClient<Database>,
  {
    courseId,
    eventDate,
    volunteerLevel,
  }: { courseId: string; eventDate: string; volunteerLevel: string | null | undefined }
): Promise<ClassTeacher[]> {
  const { data: dayEvents } = await admin
    .from("course_timetable_events")
    .select("id, title, event_date, event_time, detail, linked_tp_number, tp_group_scope_id")
    .eq("course_id", courseId)
    .eq("type", "tp")
    .eq("event_date", eventDate)
    .order("event_time");

  const mine = classLessons((dayEvents ?? []) as DayEvent[], volunteerLevel);
  if (mine.length === 0) return [];

  const [{ data: subgroups }, { data: members }] = await Promise.all([
    admin.from("course_subgroups").select("id, tp_group_id, half_order").eq("course_id", courseId),
    admin.from("course_subgroup_members").select("subgroup_id, trainee_id, base_slot").order("base_slot"),
  ]);

  // trainee id per (group, letter)
  const traineeByGroupLetter = new Map<string, string>();
  const groupIds = [...new Set((subgroups ?? []).map((s) => s.tp_group_id).filter(Boolean))] as string[];
  for (const groupId of groupIds) {
    const halves = (subgroups ?? [])
      .filter((s) => s.tp_group_id === groupId)
      .map((s) => ({
        halfOrder: (s.half_order === 2 ? 2 : 1) as 1 | 2,
        members: (members ?? [])
          .filter((m) => m.subgroup_id === s.id)
          .map((m) => ({ traineeId: m.trainee_id, baseSlot: m.base_slot })),
      }));
    for (const [traineeId, letter] of lettersForGroup(halves)) {
      traineeByGroupLetter.set(`${groupId}:${letter}`, traineeId);
    }
  }

  const wanted: { traineeId: string; tpNumber: number | null }[] = [];
  for (const e of mine) {
    const letter = letterOf(e.title);
    const groupId = e.tp_group_scope_id;
    if (!letter || !groupId) continue;
    const traineeId = traineeByGroupLetter.get(`${groupId}:${letter}`);
    if (traineeId) wanted.push({ traineeId, tpNumber: e.linked_tp_number });
  }
  if (wanted.length === 0) return [];

  const traineeIds = [...new Set(wanted.map((w) => w.traineeId))];
  const tpNumbers = [...new Set(wanted.map((w) => w.tpNumber).filter((n): n is number => n != null))];
  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", traineeIds),
    tpNumbers.length > 0
      ? admin
          .from("plan_assignments")
          .select("trainee_id, tp_number, short_title, main_lesson_aim")
          .eq("course_id", courseId)
          .in("trainee_id", traineeIds)
          .in("tp_number", tpNumbers)
      : Promise.resolve({ data: [] as { trainee_id: string; tp_number: number; short_title: string | null; main_lesson_aim: string | null }[] }),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return wanted.map((w) => {
    const a = (assignments ?? []).find((x) => x.trainee_id === w.traineeId && x.tp_number === w.tpNumber);
    return {
      name: nameById.get(w.traineeId) ?? "Your teacher",
      topic: a?.short_title || a?.main_lesson_aim || null,
    };
  });
}
