"use server";

import "server-only";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/require-role";
import { isMctOfCourse } from "@/lib/course-tutor-role";
import { ACT_PREVIEW_COOKIE } from "@/lib/act-preview";

// The header pill's two halves. Entering is gated on the REAL role -- only
// someone who actually is the MCT (or admin) can preview down; there is no
// action in the codebase that previews up. Cookie mutations in a server
// action re-render the current route on their own, so the tutor stays on
// whatever page they were reading.
export async function enterActPreview(): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id || !(await isMctOfCourse(trainer, trainer.course_id))) return;
  (await cookies()).set(ACT_PREVIEW_COOKIE, "1", { path: "/", sameSite: "lax" });
}

export async function exitActPreview(): Promise<void> {
  await requireRole(["trainer", "admin"]);
  (await cookies()).delete(ACT_PREVIEW_COOKIE);
}
