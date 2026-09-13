import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { data: l } = await db.auth.admin.generateLink({ type:"magiclink", email:"walk-trainer@celtaconnect.com" });
console.log(`http://localhost:3000/auth/confirm?token_hash=${l.properties.hashed_token}&type=magiclink&next=${encodeURIComponent("/trainer/assignments/766201e6-d002-4f07-a41a-d2a4283ca144")}`);
