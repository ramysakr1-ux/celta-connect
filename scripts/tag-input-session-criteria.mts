// A first-pass criteria tag for every input session on a course, and the map
// that falls out of it.
//
// Ramy, 13 Sep 2026: "we can move them around depending on the criteria that
// you're assessing them on and relevancy to the assignments as well." Before
// sessions can be ordered BY criteria, the criteria have to be ON them --
// and `course_timetable_events.input_session_criteria` was empty on all 44
// slots, even though the field is what seeds each week's peer observation
// task (input session -> criterion -> TP point -> peer task).
//
// These tags are a defensible first pass from each session's own content,
// not a Cambridge mapping -- the syllabus maps TOPICS to assessment, not
// individual sessions to criteria. Every one is editable per slot on the
// trainer's timetable, which is where a centre's own judgement goes.
//
// Run with: npx tsx scripts/tag-input-session-criteria.mts ["Course"] [--apply]
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { CRITERIA_LABELS, SHORT_CRITERIA_LABELS } from "../src/lib/celta-criteria";

const TAGS: Record<string, string[]> = {
  // 5d and 5k were sitting in this session all along and were not tagged:
  // the monitoring simulation IS managing the process so the aims are
  // reached, and "stopping an activity" plus the internal clock are
  // beginning and finishing on time. Ramy, 13 Sep 2026: "most of it is part
  // of classroom management."
  "Classroom management": ["5b", "5d", "5f", "5i", "5j", "5k"],
  // "Plan the switch" -- one lesson, three stages, pick the arrangement for
  // each -- is interaction-pattern selection, which is 4f.
  "Classroom arrangements and material use": ["4c", "4f", "5a", "5e"],
  "Lesson planning input": ["4a", "4b", "4e", "4h"],
  "Receptive skills": ["3a", "4l"],
  Sounds: ["2e", "4i"],
  "Eliciting and concept checking": ["5g", "2e"],
  "Teaching vocabulary": ["2c", "2e", "4i"],
  "Tense and aspect": ["2e", "4i"],
  PPP: ["2g", "4b", "5c"],
  "Text-based teaching": ["2c", "3a", "4c"],
  "Phonology: sounds": ["2d", "2e", "4i"],
  "Language analysis": ["4i", "4j", "4k"],
  "Connected speech": ["2d", "2e", "4i"],
  "Guided discovery": ["2e", "5c", "5g"],
  MFP: ["2e", "4i"],
  "Giving feedback on tasks": ["5h", "5j"],
  "Error correction": ["2b", "5h"],
  "Stress and intonation": ["2d", "2e", "4i"],
  "Functional language": ["2c", "2f", "4i"],
  "Test-Teach-Test": ["4b", "5c", "5g"],
  "Productive skills — writing": ["3b", "4g"],
  "Teaching speaking": ["3b", "5h", "5j"],
  "Lesson framework": ["4a", "4b", "4h"],
  "Teaching listening": ["3a", "4c", "4l"],
  "Language practice": ["2g", "4g", "5b"],
  "Drilling technique": ["2d", "2g", "5c"],
  "Teaching literacy": ["1a", "1c", "3a"],
  "Professional development and career advice": ["5m", "5n"],
  "Teaching exam classes": ["1a", "5c"],
  "Rapport and teacher talk": ["1d", "2a"],
  "Evaluating your plan": ["4n", "5m"],
};

// Four criteria are taught by the SHAPE of the course rather than by a
// session, and the map used to report them as "not taught by any input
// session" as though that were a fault. Ramy, 13 Sep 2026, ruling on each:
//
//   4m  working with colleagues in planning TP -- "starts pretty much TP6,
//       because then they have to get together and plan for TP7 and TP8 on
//       their own."
//   5l  maintaining the portfolio -- "an ongoing thing... from TP3, after
//       stage one, so you can start checking it."
//   1b  cultural backgrounds -- comes from the learner interviews, so from
//       TP3 onwards.
//   4d  materials with a professional appearance and copyright -- a planning
//       point inside Lesson planning, not a session of its own.
//
// And the wider point Ramy made straight after: "not everything has to be
// connected directly to an input session... the planning part, the feedback,
// also has a role to play, not just input sessions." A criterion with no
// session beside it is not a hole in the course. This map only ever claimed
// to show what the INPUT SESSIONS cover; supervised planning, TP feedback,
// tutorials and the portfolio carry the rest.
//
// Listed so the map says where each one IS covered instead of crying wolf.
const COVERED_BY_COURSE: Record<string, string> = {
  "1b": "the learner interviews, from TP3 on",
  "4d": "inside Lesson planning (D2)",
  "4m": "planning TP7 and TP8 together, from TP6 on",
  "5l": "the portfolio itself, checked from TP3 / after Stage 1",
};

const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)![1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)![1].trim()
);
const courseName = process.argv[2] ?? "CELTA Walkthrough (Ramy)";
const apply = process.argv.includes("--apply");

const { data: course } = await db.from("courses").select("id, name").eq("name", courseName).maybeSingle();
if (!course) { console.error(`No course called "${courseName}".`); process.exit(1); }

const { data: events } = await db
  .from("course_timetable_events")
  .select("id, title, event_date, event_time, type, linked_assignment_type, input_session_criteria")
  .eq("course_id", course.id)
  .order("event_date")
  .order("event_time");
const days = [...new Set((events ?? []).map((e) => e.event_date))].sort();
const dayOf = (d: string) => days.indexOf(d) + 1;

// --- tag ---
let tagged = 0;
for (const e of events ?? []) {
  const codes = TAGS[e.title];
  if (!codes) continue;
  if (apply) {
    const { error } = await db.from("course_timetable_events").update({ input_session_criteria: codes }).eq("id", e.id);
    if (error) throw error;
  }
  tagged += 1;
}
console.log(`${apply ? "Tagged" : "Would tag"} ${tagged} sessions on ${course.name}.\n`);

// --- the map ---
const taughtOn = new Map<string, { day: number; title: string }[]>();
for (const e of events ?? []) {
  for (const code of TAGS[e.title] ?? []) {
    const list = taughtOn.get(code) ?? [];
    list.push({ day: dayOf(e.event_date), title: e.title });
    taughtOn.set(code, list);
  }
}

console.log("What the INPUT SESSIONS cover. Supervised planning, TP feedback,");
console.log("tutorials and the portfolio carry criteria too -- this is not the");
console.log("whole course, and a blank line here is not a hole in it.\n");
console.log("CRITERION            FIRST   TAUGHT IN");
console.log("-".repeat(78));
for (const code of Object.keys(CRITERIA_LABELS)) {
  const hits = (taughtOn.get(code) ?? []).sort((a, b) => a.day - b.day);
  const first = hits.length ? `D${hits[0].day}` : "—";
  const label = `${code} ${SHORT_CRITERIA_LABELS[code] ?? ""}`.padEnd(20);
  const where = hits.length
    ? hits.map((h) => `${h.title} (D${h.day})`).join(", ")
    : COVERED_BY_COURSE[code]
      ? `by the course, not a session — ${COVERED_BY_COURSE[code]}`
      : "NOT TAUGHT BY ANY INPUT SESSION";
  console.log(`${label} ${(hits.length ? first : COVERED_BY_COURSE[code] ? "course" : "—").padEnd(7)} ${where}`);
}

// --- assignments against what feeds them ---
console.log("\n\nASSIGNMENT              SET     SESSIONS THAT FEED IT, AND WHETHER THEY COME FIRST");
console.log("-".repeat(78));
const FEEDS: Record<string, string[]> = {
  "Focus on Learner": ["1a", "1c", "2e", "4i"],
  LRT: ["2e", "4i", "4j", "4k"],
  Skills: ["3a", "3b", "4c", "4l"],
  LfC: ["5m", "5n"],
};
for (const [type, codes] of Object.entries(FEEDS)) {
  const setEvent = (events ?? [])
    .filter((e) => e.linked_assignment_type === type && /set|Focus on the Learner/i.test(e.title))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
  const setDay = setEvent ? dayOf(setEvent.event_date) : null;
  const feeders = codes.flatMap((c) => taughtOn.get(c) ?? []).sort((a, b) => a.day - b.day);
  const after = feeders.filter((f) => setDay !== null && f.day > setDay);
  console.log(`${type.padEnd(22)} ${setDay ? `D${setDay}`.padEnd(7) : "—".padEnd(7)} ${feeders.length} sessions, first D${feeders[0]?.day ?? "-"}, last D${feeders[feeders.length - 1]?.day ?? "-"}`);
  if (after.length) {
    console.log(`${" ".repeat(30)}${after.length} land AFTER it is set: ${[...new Set(after.map((a) => `${a.title} (D${a.day})`))].join(", ")}`);
  }
}
if (!apply) console.log("\nNothing was written. Re-run with --apply.");
