#!/usr/bin/env node
/**
 * Every query on a trainer-hub page must narrow to the course.
 *
 * Hub pages read through the service role once the page has proven the
 * caller is a tutor on the course (src/lib/supabase/hub-read.ts), so row
 * security is not the thing stopping a query from returning another
 * course's rows -- the query's own filters are. This fails the build for
 * any `.from("...")` chain in a hub page file with no narrowing call.
 *
 * Escape hatch for a genuinely course-wide read (reference data, a centre
 * document list): put this on the line above the query:
 *     // course-wide: <reason>
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/app/trainer/(hub)";
const NARROWING = /\.(eq|in|match|filter|or|contains|is|ilike|neq|gt|gte|lt|lte)\s*\(|\.maybeSingle\(\)|\.single\(\)/;
const EXEMPT = /\/\/\s*course-wide:/;
const isPage = (f) => /\/page\.tsx$/.test(f);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(ROOT)) {
  if (!isPage(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!/\.from\(\s*["']/.test(line) || /\.storage\s*\.from\(/.test(line)) return;
    const prev = lines[i - 1] ?? "";
    if (EXEMPT.test(line) || EXEMPT.test(prev)) return;
    // The chain: this line plus following lines that continue it.
    let chain = line;
    for (let j = i + 1; j < lines.length && j < i + 25; j++) {
      const t = lines[j].trim();
      if (t.startsWith(".") || t.startsWith(")") || t === "" ) { chain += "\n" + lines[j]; continue; }
      break;
    }
    if (NARROWING.test(chain)) return;
    problems.push(`${file}:${i + 1}: query has no course narrowing -- add .eq("course_id", ...) or similar, or a "// course-wide: <reason>" line above`);
  });
}
if (problems.length) {
  console.error("check-course-scope: hub page queries without a course filter:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("check-course-scope: ok");
