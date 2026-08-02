import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: usersPage } = await supabase.auth.admin.listUsers({ perPage: 200 });
const trainee = usersPage.users.find((u) => u.email?.toLowerCase() === "ramysakr1@yahoo.com");
const { data: profile } = await supabase
  .from("profiles")
  .select("course_id")
  .eq("id", trainee.id)
  .maybeSingle();
const courseId = profile.course_id;

await supabase.from("plan_assignments").delete().eq("trainee_id", trainee.id);
await supabase.from("tp_lessons").delete().eq("trainee_id", trainee.id).not("tp_number", "is", null);

const { data: inserted, error } = await supabase
  .from("plan_assignments")
  .insert([
    {
      course_id: courseId,
      trainee_id: trainee.id,
      tp_number: 1,
      rotation_position_used: 1,
      density_tier: "scripted",
      main_lesson_aim: "Verify flow -- TP1 present simple routines",
    },
    {
      course_id: courseId,
      trainee_id: trainee.id,
      tp_number: 2,
      rotation_position_used: 1,
      density_tier: "scripted",
      main_lesson_aim: "Verify flow -- TP2 past simple narrative",
    },
  ])
  .select("id, tp_number");

console.log("trainee id:", trainee.id);
console.log(error ? `SEED ERROR: ${error.message}` : "SEEDED:", inserted);
