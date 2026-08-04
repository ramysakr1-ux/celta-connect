import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { MaterialsCard } from "@/app/student/[token]/materials-card";
import { Wordmark } from "@/components/wordmark";

// §14 -- the volunteer-student (TP student) view. No login, no password --
// resolved entirely from a tokenized, course-scoped, auto-expiring link
// (migration 0030), so every read here goes through the admin client with
// explicit course/volunteer scoping rather than relying on RLS (there is no
// auth.uid() session on this path at all). Deliberately a different, warmer
// visual tone from the rest of the app, and deliberately minimal: one
// progress bar, one materials card, nothing else -- per the architecture
// plan's SS14 shell.
export default async function StudentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("*")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken || !accessToken.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="sheet-accent w-full max-w-sm p-8 text-center">
          <Wordmark size="lg" />
          <p className="mt-4 text-sm text-destructive">
            This link has expired or isn&apos;t valid. Ask your teacher for a new one.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: volunteer }, { data: course }, { data: tpEvents }, { data: attendance }, { data: sharedMaterials }] =
    await Promise.all([
      admin.from("volunteer_students").select("name").eq("id", accessToken.volunteer_student_id).maybeSingle(),
      admin.from("courses").select("name").eq("id", accessToken.course_id).maybeSingle(),
      admin.from("course_timetable_events").select("id").eq("course_id", accessToken.course_id).eq("type", "tp"),
      admin.from("volunteer_attendance").select("timetable_event_id").eq("volunteer_student_id", accessToken.volunteer_student_id),
      admin
        .from("volunteer_shared_materials")
        .select("id, created_at, tp_materials(id, file_name, slides_url, storage_path, tp_plans(main_aims))")
        .eq("course_id", accessToken.course_id)
        .order("created_at", { ascending: false }),
    ]);

  if (!volunteer) notFound();

  const totalSessions = tpEvents?.length ?? 0;
  const attendedSessions = attendance?.length ?? 0;
  const progressPct = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

  // Resolved server-side with the admin client -- a volunteer has no
  // Supabase session at all, so a browser client could never sign a
  // storage URL themselves the way MaterialsSection does for trainees.
  const resolvedMaterials = await Promise.all(
    (sharedMaterials ?? []).map(async (row) => {
      const material = row.tp_materials as unknown as {
        id: string;
        file_name: string | null;
        slides_url: string | null;
        storage_path: string | null;
        tp_plans: { main_aims: string | null } | null;
      } | null;
      if (!material) return null;

      let url = material.slides_url;
      if (!url && material.storage_path) {
        const { data: signed } = await admin.storage.from("tp-materials").createSignedUrl(material.storage_path, 3600);
        url = signed?.signedUrl ?? null;
      }
      if (!url) return null;

      return {
        id: material.id,
        name: material.file_name ?? "Material",
        url,
        topic: material.tp_plans?.main_aims ?? null,
      };
    })
  );
  const materials = resolvedMaterials.filter((m): m is NonNullable<typeof m> => m !== null);

  return (
    <div className="min-h-screen bg-[#fdf6ec]">
      <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-10">
        <div>
          <p className="text-sm font-medium text-[#b3892f] uppercase tracking-wide">{course?.name ?? "Your course"}</p>
          <h1 className="mt-1 font-serif text-3xl text-[#3a2e18]">Hi {volunteer.name}!</h1>
        </div>

        <div className="rounded-xl border border-[#eddfc4] bg-white p-6">
          <p className="text-sm text-[#8a6a2f]">Your progress</p>
          <p className="mt-1 text-2xl font-semibold text-[#3a2e18]">
            {attendedSessions} of {totalSessions || "?"} sessions attended
          </p>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#f0e6d0]">
            <div className="h-full rounded-full bg-[#4f9464] transition-all" style={{ width: `${Math.max(progressPct, 4)}%` }} />
          </div>
        </div>

        <MaterialsCard materials={materials} />
      </div>
    </div>
  );
}
