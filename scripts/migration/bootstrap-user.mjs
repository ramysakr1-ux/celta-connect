// Migration 0002 is a one-time bootstrap that raises an exception unless an
// auth user already exists for ramysakr1@gmail.com -- it was written to be
// run against a project where that account had been made by hand in the
// dashboard. On a brand-new project nothing has, so the whole push stops on
// the second migration.
//
// Creating the account satisfies it. The bootstrap then inserts a "My
// Center" placeholder plus a course and an admin profile, which are junk on
// a project about to receive the real data -- cleanup-bootstrap.mjs removes
// them before the copy runs.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.migration", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const s = createClient(env.NEW_SUPABASE_URL, env.NEW_SERVICE_ROLE_KEY);

const EMAIL = "ramysakr1@gmail.com";
const { data: existing } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (existing?.users?.some((u) => u.email === EMAIL)) {
  console.log(`already present: ${EMAIL}`);
} else {
  const { error } = await s.auth.admin.createUser({ email: EMAIL, email_confirm: true });
  if (error) throw new Error(`could not create ${EMAIL}: ${error.message}`);
  console.log(`created bootstrap auth user: ${EMAIL}`);
}
