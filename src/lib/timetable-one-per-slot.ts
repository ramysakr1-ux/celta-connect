import type { TimetableEvent } from "@/lib/timetable-grid";

/**
 * The timetable is the course PROGRAMME, and a TP slot appears on it once.
 *
 * Ramy, 6 Sep 2026: "both groups teach the same three slots at the same
 * times, in their own rooms, so the timetable is identical whether the
 * course has one group or two." Since 11 Sep the data has carried one TP row
 * per group -- which is right, because the level, the tutor, the register and
 * the lesson records all belong to a group -- but the board drew both, so
 * every TP band showed the same lesson twice and a day read as six lessons
 * instead of three. Ramy, 15 Sep 2026: "there are only three TPs per day...
 * I don't know why all the TPs are duplicated."
 *
 * So the board shows one card per slot. Which group's row survives is the
 * reader's own, so the level and the join link on the card are theirs; a
 * reader with no group of their own (an admin, an assessor) gets the first
 * by group id, stably. Nothing is deleted: the other group's row is still
 * there for its register, its plans and its records.
 */
export function oneTpCardPerSlot(events: TimetableEvent[], viewerGroupIds: Set<string> | null): TimetableEvent[] {
  const bySlot = new Map<string, TimetableEvent[]>();
  for (const e of events) {
    if (e.type !== "tp") continue;
    const key = `${e.event_date}|${e.event_time ?? ""}|${e.title}`;
    bySlot.set(key, [...(bySlot.get(key) ?? []), e]);
  }
  const dropped = new Set<string>();
  for (const rows of bySlot.values()) {
    if (rows.length < 2) continue;
    const mine = viewerGroupIds ? rows.find((r) => r.tp_group_scope_id && viewerGroupIds.has(r.tp_group_scope_id)) : null;
    const keep = mine ?? [...rows].sort((a, b) => (a.tp_group_scope_id ?? "").localeCompare(b.tp_group_scope_id ?? ""))[0];
    for (const r of rows) if (r.id !== keep.id) dropped.add(r.id);
  }
  return events.filter((e) => !dropped.has(e.id));
}
