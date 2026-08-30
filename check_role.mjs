import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: cs } = await a.from("centers").select("id, name").eq("is_demo", true);
for (const c of cs ?? []) {
  const { data: roles } = await a.from("centre_custom_roles").select("role_key, label").eq("center_id", c.id);
  const { data: ov } = await a
    .from("centre_permission_overrides")
    .select("role_key, capability_key, granted_level")
    .eq("center_id", c.id);
  console.log(`${c.name}: customRoles=${JSON.stringify(roles)} overrides=${ov?.length ?? 0}`);
  for (const o of ov ?? []) console.log(`   ${o.role_key} ${o.capability_key} = ${o.granted_level}`);
}
