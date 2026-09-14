// Every input session on a course's timetable, and whether it opens.
//
// Ramy, 13 Sep 2026: "is everything on the timetable working? We should have
// enough input sessions that are interactive and designed and ready to ship,
// exactly as the ones on a timetable."
//
// Answers that from the real data, using the SAME resolution the candidate's
// Resources tab uses -- the tutor's own pick first (course_timetable_events
// .registry_slug, migration 0301), then the title map. Nothing is guessed.
//
// Run with: npx tsx scripts/audit-input-sessions.mts ["Course name"]
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { INPUT_SESSIONS } from "../src/app/input-sessions/registry";
import { inputSessionSlugForTitle } from "../src/lib/input-session-registry-links";

// Sessions that are on the timetable but are deliberately NOT interactive --
// milestones, observations, and the slots that open something else. Listed so
// "no session" never has to be read as "broken".
const INERT_BY_DESIGN = [
  /^Course introduction/i,
  /^Course close/i,
  /^Course evaluation$/i,
  /^CELTA 5 -- final day signatures$/i,
  /^Demo lesson/i,
  /^Filmed observation/i,
  /^Syllabus planning/i,
  /^Supervised review/i,
  /^Focus on the Learner$/i, // the assignment session: opens the brief
  /^Unassessed teach/i,
  /^Lesson planning$/i, // supervised planning time, not the input session
  /^Feedback$/i,
  /^Lunch$/i,
  /^Consultation/i,
];

const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)![1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)![1].trim()
);

const courseName = process.argv[2] ?? "CELTA Walkthrough (Ramy)";
const { data: course } = await db.from("courses").select("id, name").eq("name", courseName).maybeSingle();
if (!course) {
  console.error(`No course called "${courseName}".`);
  process.exit(1);
}

const { data: events } = await db
  .from("course_timetable_events")
  .select("title, event_date, type, registry_slug")
  .eq("course_id", course.id)
  .eq("type", "input_session")
  .order("event_date");

const slugs = new Set(INPUT_SESSIONS.map((s) => s.slug));
const opens: string[] = [];
const inert: string[] = [];
const broken: string[] = [];
const seen = new Set<string>();

for (const e of events ?? []) {
  const slug = e.registry_slug ?? inputSessionSlugForTitle(e.title);
  const how = e.registry_slug ? "picked" : "title";
  if (slug && slugs.has(slug)) {
    seen.add(slug);
    opens.push(`  ${e.event_date}  ${e.title}  ->  ${slug} (${how})`);
  } else if (INERT_BY_DESIGN.some((re) => re.test(e.title))) {
    inert.push(`  ${e.event_date}  ${e.title}`);
  } else {
    broken.push(`  ${e.event_date}  ${e.title}${slug ? `  -> ${slug} (NOT IN REGISTRY)` : ""}`);
  }
}

console.log(`\n${course.name} — ${(events ?? []).length} input-session slots\n`);
console.log(`OPENS (${opens.length})`);
console.log(opens.join("\n") || "  none");
console.log(`\nINERT BY DESIGN (${inert.length})`);
console.log(inert.join("\n") || "  none");
console.log(`\nDEAD — a slot with no interactive session (${broken.length})`);
console.log(broken.join("\n") || "  none");

const orphans = INPUT_SESSIONS.filter((s) => !seen.has(s.slug));
console.log(`\nBUILT BUT NOT ON THIS TIMETABLE (${orphans.length})`);
console.log(orphans.map((s) => `  ${s.slug} — ${s.title}`).join("\n") || "  none");
console.log(`\n${INPUT_SESSIONS.length} interactive sessions built in total.\n`);
