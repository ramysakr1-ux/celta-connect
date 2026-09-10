#!/usr/bin/env node
/**
 * Remove a course and its cohort from a REAL centre.
 *
 * C4/2026 turned out to be a dry-run fixture built on Elmswood on 8 August
 * 2026: all seventeen "trainees" were *.dryrun@example.com, the eighteen
 * volunteers were "Elementary Volunteer 1 (A2)" and friends, and the one
 * applicant was ramy@yahoo.com. It had been treated as a real November cohort
 * in several sessions, including by me. Ramy, 10 Sep 2026: clear it, course and
 * all, and build the real one fresh.
 *
 * This deletes from a live centre, so it is built to be hard to misuse:
 *
 *   - It prints everything it would touch and stops. Nothing happens without
 *     --confirm.
 *   - It REFUSES to run if any profile in scope does not match the test-account
 *     pattern. A real trainee in the cohort aborts the whole thing.
 *   - It never touches the centre itself, its library, its templates, or any
 *     profile that is not on this course. Elmswood's eight coursebooks and 144
 *     library points were made by a real account and stay exactly where they are.
 *   - One transaction. If anything fails, nothing is deleted.
 *
 *   node scripts/purge-course.mjs --course "C4/2026"
 *   node scripts/purge-course.mjs --course "C4/2026" --confirm
 */

import pg from "pg";
import fs from "node:fs";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const CONFIRM = process.argv.includes("--confirm");
const COURSE_NAME = arg("course");
if (!COURSE_NAME) { console.error("Need --course \"<name>\"."); process.exit(1); }

/** A profile may only be deleted if it looks like a test account. This is the
 *  only thing standing between this script and a real person's record. */
const TEST_EMAIL = /@example\.com$/i;

const envOf = (file) => Object.fromEntries(
  fs.readFileSync(file, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const mig = envOf(".env.migration");
const client = new pg.Client({ connectionString: mig.NEW_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

// ------------------------------------------------------------------ scope ---
const [course] = await q(
  `select c.id, c.name, c.start_date, c.end_date, c.center_id, ce.name as centre, ce.is_demo
     from courses c join centers ce on ce.id = c.center_id where c.name = $1`, [COURSE_NAME]);
if (!course) { console.error(`No course named "${COURSE_NAME}".`); process.exit(1); }

const people = await q(`select id, full_name, email, role from profiles where course_id = $1 order by role, full_name`, [course.id]);
const notTest = people.filter((p) => !TEST_EMAIL.test(p.email ?? ""));

// ::text, not toISOString(). pg hands a `date` column back as a Date at local
// midnight and toISOString() then shifts it into the previous day -- the same
// date-only mistake formatCalendarDate exists to stop, made again here within
// hours of fixing it. It printed this course as starting 5 November.
const [dates] = await q(`select start_date::text as s, end_date::text as e from courses where id = $1`, [course.id]);
console.log(`\nCourse   ${course.name}   ${dates.s} -> ${dates.e}`);
console.log(`Centre   ${course.centre}${course.is_demo ? " (demo)" : " (REAL CENTRE)"}`);
console.log(`People   ${people.length} profile(s) on this course\n`);

if (notTest.length > 0) {
  console.error("REFUSING TO RUN. These profiles do not look like test accounts:\n");
  for (const p of notTest) console.error(`   ${p.full_name} <${p.email ?? "no email"}>  role=${p.role}`);
  console.error("\nNothing has been deleted. Move or rename them first, or purge them by hand.");
  process.exit(1);
}

// -------------------------------------------------------------- discovery ---
// Every table that actually holds a row pointing at this course or at one of
// these people. Asked of the database rather than listed by hand: profiles has
// 122 non-cascading references and a list written out here would rot.
const ids = people.map((p) => p.id);
const fks = await q(
  `select tc.table_name as child, kcu.column_name as col, ccu.table_name as parent
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
     join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
      and ccu.table_name in ('courses','profiles')`);

const hits = [];
for (const fk of fks) {
  if (fk.child === "profiles" && fk.col === "course_id") continue; // the profiles themselves
  // courses.duplicated_from_course_id points at ANOTHER course. Treating this
  // table as a child would mean "delete every course duplicated from this one",
  // which is not remotely what is being asked for. The course row is the last
  // deliberate step at the bottom of this file and nowhere else.
  if (fk.child === "courses") continue;
  const val = fk.parent === "courses" ? course.id : ids;
  const sql = fk.parent === "courses"
    ? `select count(*)::int as n from public.${fk.child} where ${fk.col} = $1`
    : `select count(*)::int as n from public.${fk.child} where ${fk.col} = any($1)`;
  try {
    const [{ n }] = await q(sql, [val]);
    if (n > 0) hits.push({ table: fk.child, col: fk.col, n, byCourse: fk.parent === "courses" });
  } catch { /* a view or a table we cannot count is not something we will delete */ }
}
hits.sort((a, b) => b.n - a.n || a.table.localeCompare(b.table));

console.log("Rows that reference this course or these people:\n");
for (const h of hits) console.log(`   ${String(h.n).padStart(5)}  ${h.table}.${h.col}`);
console.log(`\n   ${String(people.length).padStart(5)}  profiles (and their auth accounts)`);
console.log(`   ${String(1).padStart(5)}  courses\n`);

if (!CONFIRM) {
  console.log("Dry run. Nothing deleted. Re-run with --confirm to go ahead.\n");
  await client.end();
  process.exit(0);
}

// ----------------------------------------------------------------- delete ---
// One transaction. Children first, then the people, then the course. Anything
// that fails rolls the whole thing back.
console.log("Deleting...\n");
await client.query("begin");
try {
  for (const h of hits) {
    const res = await client.query(
      h.byCourse
        ? `delete from public.${h.table} where ${h.col} = $1`
        : `delete from public.${h.table} where ${h.col} = any($1)`,
      [h.byCourse ? course.id : ids]
    );
    if (res.rowCount > 0) console.log(`   -${String(res.rowCount).padStart(5)}  ${h.table}.${h.col}`);
  }
  // auth.users cascades public.profiles.
  const gone = await client.query(`delete from auth.users where id = any($1)`, [ids]);
  console.log(`   -${String(gone.rowCount).padStart(5)}  auth.users (profiles cascade)`);
  const left = await client.query(`delete from public.profiles where id = any($1)`, [ids]);
  if (left.rowCount > 0) console.log(`   -${String(left.rowCount).padStart(5)}  profiles (no auth row)`);
  const c = await client.query(`delete from public.courses where id = $1`, [course.id]);
  console.log(`   -${String(c.rowCount).padStart(5)}  courses`);
  await client.query("commit");
  console.log("\nDone. Committed.\n");
} catch (e) {
  await client.query("rollback");
  console.error("\nFAILED, rolled back. Nothing was deleted.\n");
  console.error(e.message);
  process.exit(1);
}
await client.end();
