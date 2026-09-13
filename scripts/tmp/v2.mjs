import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: v } = await db.from("assignment_template_versions").select("assignment_type,version,published_at,sections,published_by").eq("template_id","1b2ebc15-f0ee-474e-98cb-e7c0094978e6").order("version");
for (const r of v) console.log("LfC v" + r.version, r.published_at.slice(0,19), "| last section:", r.sections[r.sections.length-1].title, "| by:", r.published_by ? "set" : "null");
