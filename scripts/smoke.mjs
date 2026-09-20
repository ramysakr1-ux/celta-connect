#!/usr/bin/env node
/**
 * Opens every page as every role and says which ones are broken.
 *
 * Ramy, 10 Sep 2026, asking how to stop bugs reaching the real course. The
 * honest answer was that there was no way to: 128 pages, 60 route handlers and
 * nine roles, every one of them verified exactly once, by me, by looking at it.
 * Nothing re-checked yesterday's work, so a change could silently break a
 * screen built weeks earlier and we would find out when somebody opened it.
 *
 * This is the net. It is deliberately dependency-free -- no browser, no test
 * runner, nothing to install -- because a check you have to set up is a check
 * that stops being run.
 *
 * What it catches, which is the class of bug that has actually bitten us:
 *
 *   - a page that 500s, or 404s, for a role that should reach it
 *   - a page that bounces to /login for a role that is signed in (this is what
 *     push notifications died of for weeks: /sw.js redirected to /login, and
 *     service worker registration fails on a redirect)
 *   - a page that renders Next's error boundary instead of itself
 *   - a page nobody can reach because its route moved
 *
 * What it does NOT catch, and is not pretending to: anything that needs a
 * browser -- hydration mismatches, console errors, layout. Those want
 * Playwright, which is a bigger decision than this file.
 *
 *   node scripts/smoke.mjs                          # against localhost:3000
 *   node scripts/smoke.mjs --base https://www.celtaconnect.com
 *   node scripts/smoke.mjs --role trainee           # just one role
 *
 * Exits non-zero if anything failed, so it can go in front of a deploy.
 */

import fs from "node:fs";
import path from "node:path";

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = (arg("base") ?? process.env.SMOKE_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const ONLY_ROLE = arg("role");
const VERBOSE = process.argv.includes("--verbose");
// The demo day every role is read on. Pinned, so the future-date check below
// has a fixed "today" to judge against (Ramy, 20 Sep 2026: "add the
// future-date check to the smoke test").
const DAY = Number(arg("day", "15"));

// ---------------------------------------------------------------- cookies ---
// Node's fetch has no cookie jar and every one of these sessions is a cookie.
class Jar {
  constructor() { this.c = new Map(); }
  absorb(res) {
    // getSetCookie() keeps them separate; a joined header cannot be split on
    // "," because Expires= contains one.
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "" || /Max-Age=0/i.test(line)) this.c.delete(name);
      else this.c.set(name, value);
    }
  }
  header() {
    return [...this.c.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

/** One request, following redirects by hand so the final URL is visible. */
async function visit(jar, urlPath, maxHops = 8) {
  let url = urlPath.startsWith("http") ? urlPath : BASE + urlPath;
  for (let hop = 0; hop < maxHops; hop += 1) {
    let res;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { cookie: jar.header(), "user-agent": "connect-smoke/1" },
      });
    } catch (e) {
      return { status: 0, finalUrl: url, error: e.message, body: "" };
    }
    jar.absorb(res);
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    const body = type.includes("text") || type.includes("json") ? await res.text() : "";
    return { status: res.status, finalUrl: url, body, contentType: res.headers.get("content-type") ?? "" };
  }
  return { status: 0, finalUrl: url, error: `more than ${maxHops} redirects`, body: "" };
}

// ------------------------------------------------------------------ roles ---
// `door` is the demo entry point that mints a session; `prefixes` are the parts
// of the app this role is supposed to be able to open. A role is only asked for
// pages in its own area -- a trainee being bounced out of /centre is the system
// working, not a failure, and a smoke test that reported it would be noise.
const ROLES = [
  { name: "trainee", door: "/demo/trainee", prefixes: ["/portfolio"] },
  { name: "trainer", door: "/demo/trainer", prefixes: ["/trainer"] },
  { name: "trainer-act", door: "/demo/trainer-act", prefixes: ["/trainer"] },
  { name: "course-admin", door: "/demo/course-admin", prefixes: ["/dashboard"] },
  { name: "centre-admin", door: "/demo/centre-admin", prefixes: ["/centre", "/dashboard"] },
  { name: "centre-owner", door: "/demo/centre-owner", prefixes: ["/centre", "/dashboard"] },
  { name: "centre-observer", door: "/demo/centre-observer", prefixes: ["/centre"] },
  { name: "assessor", door: "/demo/assessor", prefixes: ["/assessor"] },
  { name: "volunteer", door: "/demo/volunteer", prefixes: ["/student"] },
];

/** Reachable by anyone, signed in or not. A page here may legitimately
 *  redirect (/demo bounces you onward), so only errors count. */
const PUBLIC_PATHS = [
  "/", "/login", "/apply", "/forgot-password", "/getting-started",
  "/candidate-agreement", "/terms", "/demo", "/demo/journey",
];

/** Files the BROWSER fetches, not the reader -- and the rules are stricter,
 *  because the browser is not forgiving the way a person is.
 *
 *  Push notifications were built, shipped, and had never once worked: the proxy
 *  redirected /sw.js to /login, and service worker registration fails outright
 *  on a redirect. Nothing looked broken -- /sw.js "worked", it just answered
 *  with a login page, 200 and all. So an asset has to arrive AT THE PATH ASKED
 *  FOR, with a plausible content type. Following the redirect and shrugging at
 *  the 200 is precisely how that survived for weeks. */
const PUBLIC_ASSETS = [
  { path: "/sw.js", type: /javascript/ },
  { path: "/manifest.webmanifest", type: /json|manifest/ },
];

// ----------------------------------------------------------------- routes ---
function routeList() {
  const out = [];
  const walk = (dir, url) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith("_") || name.startsWith("@")) continue;
      const next = path.join(dir, name);
      // (group) folders do not appear in the URL.
      const segment = name.startsWith("(") && name.endsWith(")") ? "" : `/${name}`;
      walk(next, url + segment);
    }
    if (fs.existsSync(path.join(dir, "page.tsx"))) out.push(url === "" ? "/" : url);
  };
  walk("src/app", "");
  return out.sort();
}

// [id] does not mean the same thing twice. /centre/courses/[id] wants a course,
// /trainer/coursebooks/[id] wants a coursebook and /dashboard/admissions/[id]
// wants an applicant -- the first draft filled all of them with a course id and
// reported fifteen "missing routes" that were nothing of the sort. Where a
// param needs something other than its own name, say so here.
const PARAM_SOURCE = {
  "/trainer/assignment-briefs/[id]": { id: "assignmentTemplateId" },
  "/dashboard/admin/assignment-briefs/[id]": { id: "assignmentTemplateId" },
  "/trainer/coursebooks/[id]": { id: "coursebookId" },
  "/dashboard/admin/coursebooks/[id]": { id: "coursebookId" },
  "/dashboard/admissions/[id]": { id: "applicantId" },
  "/portfolio/[traineeId]/supervised/[eventId]": { eventId: "supervisedEventId" },
  // This one needs a filmed-observation event, not any event on the course:
  // the page 404s on anything else, quite correctly. It was passing the
  // generic eventId and reporting "route missing" for a route that is there.
  "/trainer/timetable/filmed-observation/[eventId]": { eventId: "filmedEventId" },
  "/trainer/timetable/register/[eventId]": { eventId: "tpEventId" },
  // Only a trainee who came through the admissions pipeline HAS an
  // application, so this page needs that trainee, not just any trainee.
  "/portfolio/[traineeId]/application": { traineeId: "enrolledApplicantTraineeId" },
};

/** Real ids from the demo data, so a dynamic route can actually be opened. */
async function fixtures() {
  const env = Object.fromEntries(
    fs.readFileSync(".env.local", "utf8").split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: centre } = await db.from("centers").select("id").eq("is_demo", true).limit(1).maybeSingle();
  // The course running today, not the newest row: the demo centre carries a
  // next intake as well (seed-demo-pipeline.mjs), and the newest row is that.
  const today = new Date().toISOString().slice(0, 10);
  const { data: course } = await db.from("courses").select("id").eq("center_id", centre?.id).lte("start_date", today).order("start_date", { ascending: false }).limit(1).maybeSingle();
  const one = async (table, select, filter = (q) => q) =>
    (await filter(db.from(table).select(select)).limit(1).maybeSingle()).data;

  const trainee = await one("profiles", "id", (q) => q.eq("email", "demo-amara@celtaconnect.com"));
  const assignment = await one("assignments", "id", (q) => q.eq("trainee_id", trainee?.id));
  // The role is "volunteer_student", not "volunteer" -- getting this wrong
  // skipped the volunteer's two pages silently, which is the failure mode this
  // whole script exists to stop, so the skip list is printed for a reason.
  const token = await one("course_access_tokens", "token", (q) =>
    q.eq("course_id", course?.id).eq("role", "volunteer_student"));
  const letter = await one("trainee_letters", "id", (q) => q.eq("trainee_id", trainee?.id));
  const invite = await one("individual_tutorial_invites", "id", (q) => q.eq("trainee_id", trainee?.id));
  const session = await one("input_sessions_delivered", "id", (q) => q.eq("course_id", course?.id));
  const event = await one("course_timetable_events", "id", (q) => q.eq("course_id", course?.id));
  const filmed = await one("course_timetable_events", "id", (q) =>
    q.eq("course_id", course?.id).eq("type", "milestone").ilike("title", "Filmed observation%"));
  // A register belongs to a TP session and the page 404s on anything else,
  // quite correctly -- the generic event fixture is an input session.
  const tpEvent = await one("course_timetable_events", "id", (q) => q.eq("course_id", course?.id).eq("type", "tp"));

  // Scoped to the demo centre. Unscoped, this picked up Elmswood's templates
  // and every brief page 404'd -- correctly, since a demo trainer cannot open
  // the real centre's brief. The demo centre has none of its own.
  const template = await one("assignment_templates", "id", (q) => q.eq("center_id", centre?.id));
  const coursebook = await one("tp_coursebooks", "id", (q) => q.eq("center_id", centre?.id));
  const applicant = await one("applicants", "id", (q) => q.eq("intake_course_id", course?.id));
  const supervised = await one("course_timetable_events", "id", (q) =>
    q.eq("course_id", course?.id).eq("type", "supervised_session"));
  const enrolledApplicant = await one("applicants", "resulting_trainee_id", (q) =>
    q.not("resulting_trainee_id", "is", null).eq("intake_course_id", course?.id));

  // The calendar date of demo day N: the N-th distinct timetable date, which is
  // exactly what demo-clock.ts's dateForCourseDay does.
  const { data: dateRows } = await db.from("course_timetable_events").select("event_date").eq("course_id", course?.id).order("event_date", { ascending: true });
  const dates = [...new Set((dateRows ?? []).map((r) => r.event_date))].sort();
  const demoDate = dates[Math.min(Math.max(DAY, 1), dates.length) - 1] ?? today;

  return {
    demoDate,
    traineeId: trainee?.id ?? null,
    assignmentTemplateId: template?.id ?? null,
    coursebookId: coursebook?.id ?? null,
    applicantId: applicant?.id ?? null,
    supervisedEventId: supervised?.id ?? null,
    enrolledApplicantTraineeId: enrolledApplicant?.resulting_trainee_id ?? null,
    id: course?.id ?? null,
    courseId: course?.id ?? null,
    token: token?.token ?? null,
    assignmentId: assignment?.id ?? null,
    letterId: letter?.id ?? null,
    inviteId: invite?.id ?? null,
    sessionId: session?.id ?? null,
    eventId: event?.id ?? null,
    filmedEventId: filmed?.id ?? null,
    tpEventId: tpEvent?.id ?? null,
    tpNumber: "1",
    slug: "learner-profiles",
    // No sensible fixture: these address things a demo course does not have.
    blockId: null, replyId: null, caseId: null,
  };
}

/** Fill [params] from the fixture bundle; null if any one has no value. */
function fill(route, f) {
  const params = [...route.matchAll(/\[(\.\.\.)?([a-zA-Z]+)\]/g)];
  let filled = route;
  for (const [whole, , name] of params) {
    const key = PARAM_SOURCE[route]?.[name] ?? name;
    const value = f[key];
    // No fixture is not a failure -- it means the demo course has no such
    // thing, which the report says out loud rather than hiding.
    if (!value) return null;
    filled = filled.replace(whole, value);
  }
  return filled;
}

// ------------------------------------------------------------------ check ---
// Deliberately short. The first draft of this list also looked for "This page
// could not be found" and flagged all 128 pages, because Next inlines its
// not-found component into the flight payload of every page whether or not it
// renders. A real 404 comes back as a 404, which the status check already has,
// so a body marker for it bought nothing and cost every result being wrong.
//
// Anything added here has to be a string that CANNOT appear on a healthy page.
const ERROR_MARKERS = [
  "Application error: a client-side exception",
  "Application error: a server-side exception",
];

// ------------------------------------------------------ future-dated records ---
// The demo course is seeded with the whole course written at once (the record
// clock), so any page that does not read "as of today" shows the end of the
// course on day 15 -- "Marked submitted 22 Sept" on the 18th, "Posted" lists
// of 29 Sept sends. Both walks on 20 Sep 2026 found a dozen of these one page
// at a time. This is the mechanical net: a past-tense claim ("submitted",
// "filed", "sent", ...) followed within a phrase by a date later than the
// pinned demo day fails the page. A plain future date does not -- deadlines,
// the visit, "opens on Monday" are what a course is made of.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const PAST_CLAIM = /(?<!\d\s)(?<!\d)\b(sent|submitted|resubmitted|marked|returned|filed|approved|confirmed|issued|signed|logged|posted|attended|taught|completed|watched|acknowledged|received|closed|held|given|granted|recorded|uploaded|released|actioned|rotated|joined|opened|decided|countersigned|initialled|assigned|set)\b/i;
const FUTURE_WORDS = /\b(due|until|opens?|expires?|stops|ready|deadline|before|starts?|next|tomorrow|left|visits?|scheduled|will|coming|reopens?|closes|ends?|from|between)\b/i;
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}
// Pages on the real clock, not the course's demo day: the admissions pipeline
// is a next intake seeded relative to today, and its 'Released 20 September'
// is true on the day it was seeded.
const REAL_CLOCK_PAGES = [/^\/dashboard\/admissions\//, /^\/centre\/admissions/];
function futureDatedClaims(html, demoDate) {
  const text = visibleText(html);
  const [dy, dm, dd] = demoDate.split("-").map(Number);
  const demo = dy * 10000 + dm * 100 + dd;
  const hits = [];
  const re = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?\b|\b(\d{4})-(\d{2})-(\d{2})\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    let y, mo, d;
    if (m[4]) { y = Number(m[4]); mo = Number(m[5]); d = Number(m[6]); }
    else { d = Number(m[1]); mo = MONTHS[m[2].toLowerCase()]; y = m[3] ? Number(m[3]) : dy; }
    if (!mo || y * 10000 + mo * 100 + d <= demo) continue;
    // The phrase this date sits in: back to the nearest break, at most 60 chars.
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    const phrase = before.split(/[.,·|\u2014\u2013]|--|\s{2,}/).pop() ?? before;
    if (!PAST_CLAIM.test(phrase) || FUTURE_WORDS.test(phrase)) continue;
    hits.push(`${phrase.trim()} ${m[0]}`.trim());
    if (hits.length >= 3) break;
  }
  return hits;
}

function judge(role, route, url, res) {
  const landed = new URL(res.finalUrl).pathname;
  if (res.error) return `request failed -- ${res.error}`;
  if (res.status === 0) return "no response";
  if (res.status >= 500) return `HTTP ${res.status}`;
  if (res.status === 404) return "HTTP 404 -- route missing";
  if (res.status !== 200) return `HTTP ${res.status}`;
  if (role !== "public" && /^\/login/.test(landed)) return `bounced to /login (signed in as ${role})`;
  if (landed === "/" && url !== "/") return "bounced to /";
  for (const marker of ERROR_MARKERS) if (res.body.includes(marker)) return `rendered an error page (${marker.slice(0, 28)})`;
  return null;
}

// ------------------------------------------------------------------- main ---
const routes = routeList();
const f = await fixtures();
const failures = [];
let checked = 0;
const skipped = [];

console.log(`smoke: ${BASE}`);
console.log(`${routes.length} routes on disk, ${ROLES.length} roles, demo day ${DAY} = ${f.demoDate}\n`);

// Public first -- no session, so a page that leaks past the login wall shows up
// as a 200 here rather than hiding behind somebody's cookies.
{
  const jar = new Jar();
  for (const p of PUBLIC_PATHS) {
    const res = await visit(jar, p);
    checked += 1;
    // A public path is allowed to redirect; only errors count.
    const bad = res.status >= 500 || res.status === 0 ? `HTTP ${res.status}${res.error ? ` -- ${res.error}` : ""}` : null;
    if (bad) failures.push({ role: "public", route: p, why: bad });
    if (VERBOSE) console.log(`  public ${String(res.status).padEnd(4)} ${p}`);
  }

  for (const asset of PUBLIC_ASSETS) {
    checked += 1;
    let res;
    try {
      res = await fetch(BASE + asset.path, { redirect: "manual", headers: { "user-agent": "connect-smoke/1" } });
    } catch (e) {
      failures.push({ role: "public", route: asset.path, why: `request failed -- ${e.message}` });
      continue;
    }
    const type = res.headers.get("content-type") ?? "(none)";
    let why = null;
    if (res.status >= 300 && res.status < 400) why = `redirects to ${res.headers.get("location")} -- the browser will refuse it`;
    else if (res.status !== 200) why = `HTTP ${res.status}`;
    else if (!asset.type.test(type)) why = `served as ${type}, which is not what this file is`;
    if (why) failures.push({ role: "public", route: asset.path, why });
    if (VERBOSE) console.log(`  asset  ${String(res.status).padEnd(4)} ${asset.path}  ${type}${why ? `  <-- ${why}` : ""}`);
  }
  console.log(`public       ${PUBLIC_PATHS.length} paths, ${PUBLIC_ASSETS.length} assets`);
}

for (const role of ROLES) {
  if (ONLY_ROLE && role.name !== ONLY_ROLE) continue;
  const jar = new Jar();
  const entry = await visit(jar, `${role.door}${role.door.includes("?") ? "&" : "?"}day=${DAY}`);
  if (entry.status !== 200) {
    failures.push({ role: role.name, route: role.door, why: `could not sign in -- HTTP ${entry.status}` });
    console.log(`${role.name.padEnd(13)} COULD NOT SIGN IN`);
    continue;
  }

  const mine = routes.filter((r) => role.prefixes.some((p) => r === p || r.startsWith(`${p}/`)));
  let ok = 0;
  for (const route of mine) {
    const url = fill(route, f);
    if (!url) { skipped.push(`${role.name} ${route}`); continue; }
    const res = await visit(jar, url);
    checked += 1;
    const why = judge(role.name, route, url, res);
    if (why) failures.push({ role: role.name, route: url, why });
    // The way back. A demo viewer must be able to return to /demo/story from
    // every page: Ramy, 20 Sep 2026, mid-demo -- "half the pages don't have
    // it. So I couldn't get back to the demo."
    else if (role.door.startsWith("/demo/") && (res.contentType ?? "text/html").includes("text/html") && !res.body.includes('href="/demo/story"')) failures.push({ role: role.name, route: url, why: "no Demo tag -- no way back to /demo/story" });
    else {
      const claims = (res.contentType ?? "text/html").includes("text/html") && !REAL_CLOCK_PAGES.some((re) => re.test(url)) ? futureDatedClaims(res.body, f.demoDate) : [];
      if (claims.length > 0) failures.push({ role: role.name, route: url, why: `future-dated record on day ${DAY} (${f.demoDate}): ${claims.map((c) => `"${c}"`).join(" / ")}` });
      else ok += 1;
    }
    if (VERBOSE) console.log(`  ${role.name} ${String(res.status).padEnd(4)} ${url}${why ? `  <-- ${why}` : ""}`);
  }
  console.log(`${role.name.padEnd(13)} ${String(ok).padStart(3)} ok, ${String(mine.length - ok - 0).padStart(2)} not ok/skipped of ${mine.length}`);
}

console.log(`\n${checked} pages opened.`);
if (skipped.length > 0) {
  console.log(`${skipped.length} skipped -- no fixture for the id in the path:`);
  for (const s of skipped) console.log(`   ${s}`);
}

if (failures.length === 0) {
  console.log("\nAll clear.");
  process.exit(0);
}
console.log(`\n${failures.length} FAILING:\n`);
for (const x of failures) console.log(`  [${x.role}] ${x.route}\n      ${x.why}`);
process.exit(1);
