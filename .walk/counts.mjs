import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data } = await db.from("assignments").select("first_status,resubmission_status,first_overall_comment,resubmission_overall_comment");
const marked = data.filter(a=>["approved","resubmission_required"].includes(a.first_status));
console.log("marked first rounds:", marked.length, "| with an overall comment:", marked.filter(a=>a.first_overall_comment).length);
const mr = data.filter(a=>a.resubmission_status==="approved");
console.log("marked resubmissions:", mr.length, "| with an overall comment:", mr.filter(a=>a.resubmission_overall_comment).length);
