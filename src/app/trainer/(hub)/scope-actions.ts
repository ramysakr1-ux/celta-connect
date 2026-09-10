"use server";

import "server-only";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/require-role";
import { HUB_SCOPE_COOKIE } from "@/lib/hub-scope";

// The header pill's two halves: "your group" and "whole course". Display only
// -- see hub-scope.ts -- so it needs a tutor, not an MCT: an ACT clicking it
// changes nothing, because tutorScope narrows to owned groups regardless.
export async function showWholeCourse(): Promise<void> {
  await requireRole(["trainer", "admin"]);
  (await cookies()).set(HUB_SCOPE_COOKIE, "all", { path: "/", sameSite: "lax" });
}

export async function showMyGroup(): Promise<void> {
  await requireRole(["trainer", "admin"]);
  (await cookies()).delete(HUB_SCOPE_COOKIE);
}
