"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error: string | null;
}

function isWellFormedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function addVideoRecord(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);

  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const videoUrl = (formData.get("video_url") as string | null)?.trim();

  if (!title || !videoUrl) {
    return { error: "Title and a video link are required." };
  }
  if (!isWellFormedUrl(videoUrl)) {
    return { error: "That doesn't look like a valid link -- include https://." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tp_video_library").insert({
    center_id: trainer.center_id,
    title,
    description,
    video_url: videoUrl,
    added_by: trainer.id,
  });
  if (error) return { error: "Could not save. Try again." };

  revalidatePath("/trainer/video");
  return { error: null };
}

export async function deleteVideoRecord(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const videoId = formData.get("video_id");
  if (typeof videoId !== "string") return;

  const supabase = await createClient();
  await supabase.from("tp_video_library").delete().eq("id", videoId).eq("center_id", trainer.center_id);

  revalidatePath("/trainer/video");
}
