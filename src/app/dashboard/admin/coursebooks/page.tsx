import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CoursebookList } from "@/components/tp-library/coursebook-list";
import { CoursebookUploadForm } from "@/components/tp-library/coursebook-upload-form";
import { adminCreateCoursebookRecord } from "@/app/dashboard/admin/coursebooks/actions";

export default async function AdminCoursebooksPage() {
  const admin = await requireRole("admin");
  const supabase = await createClient();

  const { data: coursebooks } = await supabase
    .from("tp_coursebooks")
    .select("*")
    // single-centre: per-centre coursebook shelf; a branch owns its own
    .eq("center_id", admin.center_id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      {/* Only reached from the Centre material panel now (the persistent
          AdminTabs nav that used to link here is gone -- see dashboard/
          admin/page.tsx). A real way back, so this can't be a dead end. */}
      <BackLink href="/dashboard/admin" label={"Courses"} />
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">TP Points Library</h1>
        <p className="mt-2 text-muted">
          Upload coursebook PDFs to generate a reusable bank of TP points, tiered by density band.
        </p>
      </div>

      <div>
        <h2 id="coursebooks" className="scroll-mt-6 font-serif text-lg text-ink">Coursebooks</h2>
        <div className="mt-3">
          <CoursebookList coursebooks={coursebooks ?? []} basePath="/dashboard/admin/coursebooks" />
        </div>
      </div>

      <CoursebookUploadForm centerId={admin.center_id} action={adminCreateCoursebookRecord} />
    </div>
  );
}
