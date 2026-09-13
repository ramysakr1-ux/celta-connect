import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const { error } = await db.from("assignment_appendices").select("id").limit(1);
console.log("table:", error ? "MISSING — " + error.message : "ok");
const { data: b } = await db.storage.listBuckets();
console.log("bucket:", b?.some(x => x.id === "assignment-appendices") ? "ok" : "MISSING");
