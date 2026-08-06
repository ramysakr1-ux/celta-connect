import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { AudioList } from "@/components/tp-audio/audio-list";
import { AudioUploadForm } from "@/components/tp-audio/audio-upload-form";
import { trainerCreateAudioRecord } from "@/app/trainer/(hub)/audio/actions";

// A plain, separate audio library -- upload + browse, organised by
// level/coursebook, same pattern as the Resource Hub and TP Points
// Library (see /trainer/coursebooks). Deliberately NOT tagged per TP
// point/stage; see migration 0046 for why. Files are just named to match
// how tp_points.procedure text already refers to recordings, so a later
// pass can auto-link mentions to tracks -- that auto-linking isn't built.
export default async function TrainerAudioLibraryPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();

  const { data: tracks } = await supabase
    .from("tp_audio_library")
    .select("*")
    .eq("center_id", trainer.center_id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet p-6">
        <h1 className="font-serif text-xl text-ink">Audio Library</h1>
        <p className="mt-2 text-muted">
          Real coursebook Class/Workbook audio, browsable by level and coursebook. Not linked to individual TP
          points or stages yet -- that&rsquo;s a planned follow-up once enough tracks are named consistently.
        </p>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Tracks</h2>
        <div className="mt-3">
          <AudioList rows={tracks ?? []} />
        </div>
      </div>

      <AudioUploadForm centerId={trainer.center_id} action={trainerCreateAudioRecord} />
    </div>
  );
}
