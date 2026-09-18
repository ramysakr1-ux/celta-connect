#!/usr/bin/env node
/**
 * Follows every card on the Course Story and says which ones do not land.
 *
 * Ramy, 18 Sep 2026, walking the story before a demo: "everything goes
 * somewhere else. I can't click on any of them and it takes me where it's
 * supposed to." 130 of 143 cards had no destination and fell through to
 * their lane's landing page. Nothing would have told us: the page renders
 * perfectly either way, and smoke.mjs checks that routes answer, not that
 * the links into them go anywhere sensible.
 *
 * It signs in ONCE per demo door and then opens that door's screens on the
 * same session -- which is both what a visitor does and the only way this
 * can run at all. The first version minted a fresh magic link per card and
 * 48 of 139 came back at /login?error=invite_invalid, which looked exactly
 * like 48 broken cards and was in fact Supabase rate-limiting the link
 * generation. A checker that cries wolf gets ignored, so: one sign-in per
 * role, sessions reused, destinations opened directly.
 *
 * It cannot check that a card opens the RIGHT screen; only someone who knows
 * what the card means can. It checks that every card opens something.
 *
 *   node scripts/check-story-links.mjs
 *   node scripts/check-story-links.mjs --base http://localhost:3000 --verbose
 */
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BASE = (arg("base") ?? process.env.SMOKE_BASE ?? "https://www.celtaconnect.com").replace(/\/$/, "");
const VERBOSE = process.argv.includes("--verbose");

const jarHeader = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const drink = (jar, res) => {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
};

/** Follow redirects by hand so the cookies a demo link sets are carried on. */
async function walk(url, jar) {
  let status = 0;
  for (let hop = 0; hop < 12; hop++) {
    const res = await fetch(url, { redirect: "manual", headers: { cookie: jarHeader(jar) } });
    status = res.status;
    drink(jar, res);
    const loc = res.headers.get("location");
    if (!loc) return { status, landed: url.replace(BASE, "") };
    url = new URL(loc, url).toString();
  }
  return { status, landed: `${url.replace(BASE, "")} (too many redirects)` };
}

const page = await fetch(`${BASE}/demo/story`).then((r) => r.text());
const hrefs = [...new Set([...page.matchAll(/href="(\/demo\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))) ];
if (hrefs.length === 0) { console.error("No card links on /demo/story -- has the page moved?"); process.exit(1); }

// Group by door, so each account is signed in once.
const byDoor = new Map();
for (const href of hrefs) {
  const u = new URL(BASE + href);
  const door = u.pathname;
  if (!byDoor.has(door)) byDoor.set(door, []);
  byDoor.get(door).push({ href, to: u.searchParams.get("to"), day: u.searchParams.get("day") });
}
console.log(`${hrefs.length} card destinations behind ${byDoor.size} doors\n`);

const bad = [];
let checked = 0;
for (const [door, cards] of byDoor) {
  const jar = new Map();
  // Sign in through the door once, on whichever day the first card names.
  const entry = await walk(`${BASE}${door}${cards[0].day ? `?day=${cards[0].day}` : ""}`, jar);
  const signedIn = entry.status === 200 && !entry.landed.startsWith("/login");
  if (!signedIn) {
    bad.push({ href: door, ...entry });
    console.log(`  BAD  ${door}\n         -> ${entry.status} ${entry.landed}  (the door itself)`);
    checked += cards.length;
    continue;
  }
  for (const card of cards) {
    checked++;
    // The door with no ?to= lands on that person's own page, already proven
    // by the sign-in above.
    if (!card.to) { if (VERBOSE) console.log(`  ok   ${card.href}\n         -> ${entry.status} ${entry.landed}`); continue; }
    const target = card.to.replace(/\{me\}/g, entry.landed.split("/")[2] ?? "");
    // {course} is resolved by the demo route from the database, not by
    // anything this script can see, so those cards go the long way round --
    // through the door itself, spending a magic link. There are a handful of
    // them; going the long way for all 140 is what rate-limited the first
    // version of this script into reporting 48 false failures.
    const r = target.includes("{")
      ? await walk(BASE + card.href, new Map())
      : await walk(BASE + target, new Map(jar));
    const ok = r.status === 200 && !r.landed.startsWith("/login");
    if (!ok) bad.push({ href: card.href, ...r });
    if (VERBOSE || !ok) console.log(`  ${ok ? "ok  " : "BAD "} ${card.href}\n         -> ${r.status} ${r.landed}`);
  }
}

console.log();
if (bad.length === 0) { console.log(`All ${checked} card destinations land. All clear.`); process.exit(0); }
console.log(`${bad.length} of ${checked} card destinations do not land.`);
process.exit(1);
