import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const email = process.argv[2];
const next = process.argv[3] ?? "/trainer/assignments";
const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;
console.log(`https://celta-connect.vercel.app/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`);
