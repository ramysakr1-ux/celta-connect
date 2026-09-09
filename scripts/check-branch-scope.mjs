#!/usr/bin/env node
/**
 * Stops a single-centre read being written into a branch-aware room.
 *
 * Admissions and Course Admin used to scope every read to profiles.center_id.
 * That is invisible in a one-branch centre and silently wrong in a two-branch
 * one: the same person saw everything in Centre Management and one branch in
 * those rooms, with nothing on screen admitting it. Ramy, 2 Sep 2026: "we
 * can't afford this breaking again in the future."
 *
 * Repairing the queries fixed it once. This keeps it fixed: a page in these
 * rooms must read through resolveBranchScope() and pass the resulting scope,
 * or say in one line why it is legitimately about a single branch.
 *
 * Escape hatch, for the cases that really are per-branch -- settings, one
 * applicant by id -- put this on the line above the query:
 *     // single-centre: <reason>
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// /centre and the volunteer pool were already branch-aware; they are covered
// so they cannot drift back the way these two did.
const ROOMS = ["src/app/dashboard/admissions", "src/app/dashboard/admin", "src/app/centre"];

// Any way of narrowing a query to one centre, not just .eq(). The first
// version of this check knew only .eq(), and .match({center_id}),
// .filter("center_id", ...) and .or("center_id.eq...") all walked past it --
// three ways to write the same bug that the lock would not have caught.
// A quote or brace after the paren: that is a query filter. Array.filter()
// takes a callback, and flagging those was the first thing this stricter
// version got wrong.
const NARROWING = /\.(eq|filter|or|contains|overlaps)\s*\(\s*["'`]|\.match\s*\(\s*\{/;
const MENTIONS_CENTRE = /\b(?:to_|from_)?center_id\b/;
// Passing the resolved scope is the correct shape, in any of its spellings.
// heldCenterIds()/holdsCentre() belong here too: HOME_COMPARE below already
// names them as the right shape, and leaving them out of SCOPED made the lock
// reject its own prescribed fix -- which is exactly what happened to the
// interview-questions read on 7 Sep 2026, and it broke the build.
const SCOPED = /\bscope\b|availableCenterIds|\bmine\b|heldCenterIds|holdsCentre/;
const EXEMPT = /\/\/\s*single-centre:/;
// The marker may sit at the top of a wrapped comment, several lines above the
// query. Checking only the line immediately above meant a two-line reason
// silently stopped exempting anything.
const isComment = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);
function exemptAbove(lines, i) {
  for (let j = i - 1; j >= 0 && isComment(lines[j]); j--) {
    if (EXEMPT.test(lines[j])) return true;
  }
  return false;
}
// A row's centre compared with the person's HOME centre in plain JavaScript.
// Audit, 6 Sep 2026: the whole Course Admin course room did this -- the page
// 404'd and fifteen actions refused a course from a held branch that the
// landing had just listed -- and this lock walked past all of it because it
// only knew query narrowing. Applies to writes too: the write exemption
// below is about which centre you SAVE to, not about refusing a row you
// hold. The right shape is holdsCentre() / heldCenterIds() from
// src/lib/branch-scope.ts.
// `trainer` is deliberately absent: in the course room it names a ROW (the
// tutor being assigned), and comparing that with the course's own centre is
// the correct shape, not the bug.
const HOME_COMPARE = /\.center_id\s*[!=]==?\s*(?:admin|profile|staff|user|me|holder|viewer|session\.profile)\.center_id\b|\b(?:admin|profile|staff|user|me|holder|viewer)\.center_id\s*[!=]==?\s*\w+\.center_id\b/;

/** Writes act on one centre by definition -- you save to a branch, not to all of them. */
const isWriteFile = (f) => /actions\.ts$/.test(f);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const problems = [];
for (const room of ROOMS) {
  for (const file of walk(room)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const exempt = EXEMPT.test(line) || exemptAbove(lines, i);
      if (HOME_COMPARE.test(line) && !exempt) {
        problems.push(`${file}:${i + 1}  (compares a row's centre with the home centre -- use holdsCentre)\n    ${line.trim().slice(0, 110)}`);
        return;
      }
      if (isWriteFile(file)) return;
      if (!(MENTIONS_CENTRE.test(line) && NARROWING.test(line))) return;
      if (SCOPED.test(line)) return;
      if (exempt) return;
      problems.push(`${file}:${i + 1}\n    ${line.trim().slice(0, 110)}`);
    });
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} unexplained single-centre read${problems.length > 1 ? "s" : ""} in a branch-aware room:\n`);
  for (const p of problems) console.error("  " + p + "\n");
  console.error(`  These rooms must read every branch the person holds. Use:\n`);
  console.error(`      const { scope } = await resolveBranchScope(profile, branch);`);
  console.error(`      ...in("center_id", scope)\n`);
  console.error(`  If this one really is about a single branch, say so on the line above:\n`);
  console.error(`      // single-centre: <reason>\n`);
  process.exit(1);
}
console.log("✓ branch scope: no unexplained single-centre reads in Admissions, Course Admin or Centre Management");
