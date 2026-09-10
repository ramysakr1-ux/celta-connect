#!/usr/bin/env node
/**
 * The smoke test, in a real browser.
 *
 * smoke.mjs asks whether a page ANSWERS. This asks whether it works once it is
 * open: whether anything threw after mount, whether the server and the browser
 * agreed on what to render, and whether the layout holds on a phone. A page can
 * return a clean 200 and still be broken in all three ways, and nothing could
 * see it -- the mobile break on the trainee landing (an <h1> 42 pixels wide and
 * 200 tall, a clock printed over "Day 19 of 20") was found by a person looking
 * at it, which does not scale to 211 pages.
 *
 * Deliberately NOT a journey test. It clicks nothing and types nothing, so
 * there are no selectors to rot when a button is renamed. It opens the page and
 * checks that nothing screamed. That is most of the value of a browser for
 * almost none of the upkeep -- and a suite that fails for reasons that are not
 * bugs is a suite that gets ignored, which is worse than not having one.
 *
 *   npm run check:browser                     # against localhost:3000
 *   node scripts/browser-check.mjs --base https://www.celtaconnect.com
 *   node scripts/browser-check.mjs --role trainee --verbose
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BASE = (arg("base") ?? process.env.SMOKE_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const ONLY_ROLE = arg("role");
const VERBOSE = process.argv.includes("--verbose");

// Same doors and the same "a role only answers for its own area" rule as
// smoke.mjs. Kept in step with it deliberately: two lists that drift apart are
// two lists nobody trusts.
const ROLES = [
  { name: "trainee", door: "/demo/trainee", prefixes: ["/portfolio"], landing: true },
  { name: "trainer", door: "/demo/trainer", prefixes: ["/trainer"], landing: true },
  { name: "course-admin", door: "/demo/course-admin", prefixes: ["/dashboard"], landing: true },
  { name: "centre-admin", door: "/demo/centre-admin", prefixes: ["/centre"], landing: true },
  // The assessor pack is laid out for a laptop on purpose -- a moderation
  // visit happens at a desk -- and it carries a note saying so. Checking it at
  // 375 would report a settled decision as a fault on every run, which is how
  // a check stops being read. Console and hydration still apply; only the
  // narrow-width layout assertions are off.
  { name: "assessor", door: "/demo/assessor", prefixes: ["/assessor"], landing: true, widths: [1280] },
  { name: "volunteer", door: "/demo/volunteer", prefixes: ["/student"], landing: true },
];

/** Console noise that is not this app misbehaving. Every entry needs a reason;
 *  an ignore list is where a real failure goes to hide. */
const IGNORE = [
  // Supabase refreshing a magic-link session that has already been redeemed.
  // Happens on any demo door, is handled, and says nothing about the page.
  /refresh_token_not_found|Invalid Refresh Token/i,
  // Chrome complaining about a font or favicon it decided not to fetch.
  /favicon\.ico/i,
];

/** React says the same thing several ways depending on the build. */
const HYDRATION = /hydrat|did not match|Text content does not match|server rendered HTML/i;

function routeList() {
  const out = [];
  const walk = (dir, url) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith("_") || e.name.startsWith("@")) continue;
      walk(path.join(dir, e.name), url + (e.name.startsWith("(") && e.name.endsWith(")") ? "" : `/${e.name}`));
    }
    if (fs.existsSync(path.join(dir, "page.tsx"))) out.push(url === "" ? "/" : url);
  };
  walk("src/app", "");
  return out.sort();
}

const findings = [];
const fail = (role, where, what) => findings.push({ role, where, what });

/** Layout invariants. Not a pixel-perfect snapshot -- those break on every
 *  design change and teach you to ignore them. These are the three things that
 *  were actually wrong, expressed as questions with only one right answer. */
async function checkLayout(page, role, url, width) {
  const r = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const box = h1?.getBoundingClientRect();
    // Anything with text sitting in the top band, to catch a header printing
    // over itself -- measured as the box you can actually SEE.
    //
    // getBoundingClientRect() reports an element's full layout box even when an
    // ancestor with overflow:hidden is clipping most of it off. The first
    // version of this check compared raw boxes and reported the trainer hub's
    // header as overlapping by 64px at 1280. It was not: the tab row clips, and
    // a clipped tab still measures its whole width. I told Ramy the header
    // overlapped, and it did not.
    //
    // So intersect every rect with each clipping ancestor before comparing.
    // What is invisible cannot be on top of anything.
    const visibleRect = (el) => {
      let r = el.getBoundingClientRect();
      let p = el.parentElement;
      while (p && p !== document.documentElement) {
        if (getComputedStyle(p).overflowX !== "visible") {
          const pr = p.getBoundingClientRect();
          const left = Math.max(r.left, pr.left);
          const right = Math.min(r.right, pr.right);
          r = { left, right, top: r.top, bottom: r.bottom, width: right - left, height: r.height };
        }
        p = p.parentElement;
      }
      return r;
    };
    const top = [...document.querySelectorAll("body *")]
      .filter((e) => !e.children.length && e.textContent.trim())
      .map((e) => ({ t: e.textContent.trim().slice(0, 18), ...visibleRect(e) }))
      .filter((b) => b.top < 80 && b.height > 0 && b.width > 1);
    let overlap = null;
    for (let i = 0; i < top.length && !overlap; i += 1) {
      for (let j = i + 1; j < top.length; j += 1) {
        const a = top[i], b = top[j];
        if (Math.abs(a.top - b.top) < 12 && a.left < b.right - 2 && b.left < a.right - 2) { overlap = [a.t, b.t]; break; }
      }
    }
    return {
      h1w: box ? Math.round(box.width) : null,
      h1h: box ? Math.round(box.height) : null,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      overlap,
    };
  });
  if (r.scrollW > r.clientW + 1) fail(role, `${url} @${width}`, `the page scrolls sideways (${r.scrollW}px of content in ${r.clientW}px)`);
  // A headline narrower than it is tall is a headline broken one word per line.
  if (r.h1w !== null && r.h1h !== null && r.h1w < r.h1h && r.h1w < width / 2) {
    fail(role, `${url} @${width}`, `the headline is ${r.h1w}px wide and ${r.h1h}px tall -- it is wrapping one word per line`);
  }
  if (r.overlap) fail(role, `${url} @${width}`, `"${r.overlap[0]}" and "${r.overlap[1]}" are printed on top of each other`);
}

const routes = routeList();
const browser = await chromium.launch();
let checked = 0;

console.log(`browser check: ${BASE}`);
console.log(`chromium, ${ROLES.length} roles\n`);

for (const role of ROLES) {
  if (ONLY_ROLE && role.name !== ONLY_ROLE) continue;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const problems = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));

  await page.goto(BASE + role.door, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const landing = new URL(page.url()).pathname;
  if (landing.startsWith("/login")) { fail(role.name, role.door, "could not sign in"); await context.close(); continue; }

  const mine = routes.filter((r) => role.prefixes.some((p) => r === p || r.startsWith(`${p}/`)));
  // The only id this check knows is the one in the URL the role landed on --
  // their own. That fills /portfolio/[traineeId]/... and /student/[token]/...
  // and nothing else.
  //
  // The first draft replaced EVERY [param] with it, which turned
  // /portfolio/[traineeId]/tp/[tpNumber] into .../tp/<a uuid> and
  // /trainer/malpractice/[caseId] into /trainer/malpractice/, then reported the
  // resulting 404s as console errors. Eleven findings, all invented. Routes
  // needing an id this check cannot know are skipped and counted -- smoke.mjs
  // has the fixture table and already covers their status.
  const ownId = landing.split("/")[2] ?? null;
  let opened = 0;
  let skipped = 0;
  for (const route of mine) {
    let url = route;
    if (ownId && /^\/(portfolio\/\[traineeId\]|student\/\[token\])/.test(route)) {
      url = route.replace(/\[(traineeId|token)\]/, ownId);
    }
    if (/\[|\]/.test(url)) { skipped += 1; continue; }
    problems.length = 0;
    let status = 0;
    try {
      const res = await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 20000 });
      status = res?.status() ?? 0;
      await page.waitForTimeout(400);
    } catch (e) { fail(role.name, url, `did not load -- ${e.message.split("\n")[0]}`); continue; }
    opened += 1; checked += 1;

    // A page that is ITSELF a 404 logs its own status as a console error, and
    // some 404s are correct -- a trainee who never applied has no application
    // page. Whether a route should answer at all is smoke.mjs's question; this
    // one is only about pages that did answer.
    if (status !== 200) { if (VERBOSE) console.log(`  ${role.name} -- ${url} (HTTP ${status}, not analysed)`); continue; }

    const real = problems.filter((p) => !IGNORE.some((re) => re.test(p)));
    for (const p of real) {
      fail(role.name, url, HYDRATION.test(p) ? `HYDRATION: ${p.slice(0, 150)}` : `console error: ${p.slice(0, 150)}`);
    }
    if (VERBOSE) console.log(`  ${role.name} ${real.length ? "!!" : "ok"} ${url}`);
  }

  // Layout, on the landing only and at the three widths that matter. Every
  // page at every width would be slow and would mostly repeat the same shell.
  if (role.landing) {
    for (const width of role.widths ?? [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(BASE + landing, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      await checkLayout(page, role.name, landing.replace(ownId ?? "@@", ":id"), width);
    }
  }
  console.log(`${role.name.padEnd(13)} ${String(opened).padStart(3)} page(s) opened${skipped ? `, ${skipped} skipped (need an id this check cannot know)` : ""}`);
  await context.close();
}
await browser.close();

console.log(`\n${checked} page(s) opened in a real browser.`);
if (findings.length === 0) { console.log("\nNothing screamed.\n"); process.exit(0); }
console.log(`\n${findings.length} PROBLEM(S):\n`);
for (const f of findings) console.log(`  [${f.role}] ${f.where}\n      ${f.what}`);
process.exit(1);
