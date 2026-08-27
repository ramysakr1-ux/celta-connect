import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_ORDER, ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { AssignmentBriefUploadForm } from "@/components/assignment-templates/upload-form";
import { adminUploadAssignmentBrief } from "@/app/dashboard/admin/assignment-briefs/actions";

export default async function AdminAssignmentBriefsPage() {
  const admin = await requireRole("admin");
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("assignment_templates")
    .select("*")
    .eq("center_id", admin.center_id);

  const templateByType = new Map((templates ?? []).map((t) => [t.assignment_type, t]));
  const proseCount = (templates ?? []).filter((t) => t.format === "prose").length;
  const formatWarning =
    (templates ?? []).length === 4 && proseCount !== 2
      ? `The syllabus needs exactly two of the four briefs in academic prose -- currently ${proseCount}.`
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Reachable from Settings' own nav, and directly from the Centre
          material panel now too (dashboard/admin/page.tsx) -- a real way
          back either way. */}
      <Link href="/dashboard/admin" className="text-sm text-muted hover:text-ink">
        ← Courses
      </Link>
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Assignment Briefs</h1>
        <p className="mt-2 text-muted">
          Upload your centre&apos;s own brief for each written assignment as a PDF -- Claude splits it
          into sections you can review and edit before publishing it to trainees.
        </p>
        {formatWarning ? (
          <p className="mt-3 rounded-[6px] border border-status-warning-text/40 bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text">
            {formatWarning}
          </p>
        ) : null}
      </div>

      {ASSIGNMENT_ORDER.map((type) => {
        const template = templateByType.get(type);
        return (
          <div key={type} className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-ink">{ASSIGNMENT_INFO[type].title}</h2>
              {template ? (
                <span className="text-sm text-muted">{template.published_at ? "Published" : "Draft"}</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">{ASSIGNMENT_INFO[type].description}</p>

            {template ? (
              <Link
                href={`/dashboard/admin/assignment-briefs/${template.id}`}
                className="admin-hover-fill mt-3 inline-block rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
              >
                Review brief
              </Link>
            ) : (
              <div className="mt-3">
                <AssignmentBriefUploadForm
                  centerId={admin.center_id}
                  assignmentType={type}
                  action={adminUploadAssignmentBrief}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
