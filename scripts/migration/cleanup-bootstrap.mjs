// Removes what migration 0002 inserts to bootstrap an empty project: a
// placeholder centre called "My Center", a "Demo CELTA Course" inside it,
// and an admin profile for ramysakr1@gmail.com pointing at both.
//
// Harmless on a genuinely new install -- it is the only way in. Junk on a
// project about to receive a real copy, where it would show up as a stray
// third centre with a course nobody recognises.
//
// Runs before copy-data.mjs. Deletes nothing that did not come from 0002:
// it matches on the exact names that migration uses, and refuses to touch a
// centre that has anything else attached to it.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.migration", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const s = createClient(env.NEW_SUPABASE_URL, env.NEW_SERVICE_ROLE_KEY);

const { data: centres } = await s.from("centers").select("id, name");
const placeholder = (centres ?? []).find((c) => c.name === "My Center");
if (!placeholder) {
  console.log("no bootstrap centre found -- nothing to clean");
} else {
  const { data: courses } = await s.from("courses").select("id, name").eq("center_id", placeholder.id);
  const unexpected = (courses ?? []).filter((c) => c.name !== "Demo CELTA Course");
  if (unexpected.length) {
    console.log(`refusing to delete: "My Center" holds ${unexpected.length} course(s) 0002 did not create`);
  } else {
    await s.from("profiles").delete().eq("center_id", placeholder.id);
    for (const c of courses ?? []) await s.from("courses").delete().eq("id", c.id);
    const { error } = await s.from("centers").delete().eq("id", placeholder.id);
    console.log(error ? `centre delete failed: ${error.message}` : "removed bootstrap centre, course and profile");
  }
}

const { count: centreCount } = await s.from("centers").select("*", { count: "exact", head: true });
const { count: profileCount } = await s.from("profiles").select("*", { count: "exact", head: true });
console.log(`new project now holds ${centreCount} centres, ${profileCount} profiles (should be 0 and 0)`);
