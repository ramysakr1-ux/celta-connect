// Forbids an arbitrary font size anywhere the scale applies
// (for-claude-code-type-scale.md §3.5, 16 Sep 2026).
//
// Four exceptions keep their own sizes by design: the CELTA 5 booklet (a
// Cambridge document), the Notebook (its own paper register), the PDF routes
// and the email templates (inline styles, for mail clients that ignore
// stylesheets).
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src/app", "src/components"];
const EXEMPT = [
  /\/celta5\//, /c5-/, /notebook/i, /\/api\//, /pdf/i, /email-layout/, /-email\.ts$/, /\/emails?\//,
];
const BAD = [
  { re: /text-\[[0-9.]+px\]/g, what: "text-[Npx]" },
  { re: /fontSize: ?[0-9.]+/g, what: "inline fontSize" },
  { re: /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b/g, what: "Tailwind's own size" },
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const hits = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) {
    if (EXEMPT.some((re) => re.test(f))) continue;
    const src = fs.readFileSync(f, "utf8");
    for (const { re, what } of BAD) {
      for (const m of src.matchAll(re)) {
        const line = src.slice(0, m.index).split("\n").length;
        hits.push(`  ${f}:${line}  ${m[0]}   (${what})`);
      }
    }
  }
}

if (hits.length) {
  console.error(`\n✗ ${hits.length} text sizes off the scale:\n`);
  console.error(hits.slice(0, 40).join("\n"));
  if (hits.length > 40) console.error(`  … and ${hits.length - 40} more`);
  console.error(`\n  Use the nine: text-micro label meta body lede h3 h2 h1 display.`);
  console.error(`  See for-claude-code-type-scale.md.\n`);
  process.exit(1);
}
console.log("✓ type scale: every size is one of the nine");
