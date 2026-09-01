import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";

// Import used to live here, in Centre Management, offering a choice between
// applicants and volunteers. Both halves have moved into the rooms that own
// what they create -- /dashboard/admissions/import and
// /centre/volunteers/import. Nothing in the app linked here even before the
// move (the tab was its only door), but a bookmark is cheap to honour.
export default async function LegacyImportRedirect() {
  const profile = await requireRole("admin");
  const ctx = await getCentreRoleContext(profile);
  const flatAdmin = ctx.roles.length === 0;
  if (flatAdmin || can(ctx.roles, "import.run", ctx.overrides)) redirect("/dashboard/admissions/import");
  if (can(ctx.roles, "volunteers.manage", ctx.overrides)) redirect("/centre/volunteers/import");
  redirect("/centre");
}
