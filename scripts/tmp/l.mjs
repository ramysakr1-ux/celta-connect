import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: p } = await db.from("profiles").select("id").eq("email","walk-amara@celtaconnect.com").single();
const { data: a } = await db.from("assignments").select("id,first_status,due_date").eq("trainee_id", p.id).eq("assignment_type","LfC").single();
console.log("LfC:", a.first_status, "due", a.due_date);
const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: "walk-amara@celtaconnect.com" });
console.log(`https://celta-connect.vercel.app/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=${encodeURIComponent("/portfolio/"+p.id+"/assignments/"+a.id)}`);
