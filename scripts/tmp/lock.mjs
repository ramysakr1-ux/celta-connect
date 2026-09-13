import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data } = await db.from("courses").select("name,timetable_locked_at").eq("name","CELTA Walkthrough (Ramy)").single();
console.log(data);
