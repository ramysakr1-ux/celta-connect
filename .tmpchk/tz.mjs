import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const db = createClient(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim(), env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim());
const IDS = ["4abee818-d7a4-4bfb-96d7-1051b6088e3d","766201e6-d002-4f07-a41a-d2a4283ca144","c6a6b8d8-d971-4703-80fb-221b3fb8ece2"];
const { data } = await db.from("assignments")
  .select("id,assignment_type,first_initialled_at,second_initialled_at,second_marker_recorded_at,first_submitted_at,resubmission_submitted_at")
  .in("id", IDS);
const fmt = (iso, tz) => iso ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",timeZone:tz}).format(new Date(iso)) : null;
for (const a of data) {
  console.log("##", a.assignment_type, a.id.slice(0,8));
  for (const k of ["first_initialled_at","second_initialled_at","second_marker_recorded_at"]) {
    if (!a[k]) { console.log("   ", k, "= null"); continue; }
    const utc = fmt(a[k],"UTC"), ist = fmt(a[k],"Europe/Istanbul"), la = fmt(a[k],"America/Los_Angeles");
    console.log("   ", k, a[k], "| UTC:", utc, "| Istanbul:", ist, "| LA:", la, utc!==ist||utc!==la ? "  <<< DIFFERS" : "");
  }
}
