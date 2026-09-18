// Which timetable tiles print their own time.
//
// The band the tile sits in already says the time, so a tile repeating it is
// noise -- unless the time is the tile's own fact: a slot booked for one
// person, where "14:15" means YOUR fifteen minutes rather than the band
// everyone shares. Ramy, 19 Sep 2026: "we can have time for consultations or
// tutorials, but not for inputs", and it has to be consistent -- until now a
// tile showed its time only when it happened to have no subtitle.
//
// Matched on the tag, which is how the seed and the booking sheets label
// them (consultation-actions.ts, stage2-actions.ts, individual-tutorial-
// actions.ts): never on the title.
const PER_PERSON_TAGS = new Set(["consultation", "stage1_tutorial", "stage2_tutorial", "stage3_tutorial", "individual"]);

export function tileShowsOwnTime(tag: string | null | undefined): boolean {
  return Boolean(tag && PER_PERSON_TAGS.has(tag));
}
