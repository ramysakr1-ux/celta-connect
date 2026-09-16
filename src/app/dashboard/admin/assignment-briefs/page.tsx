import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_ORDER, ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { AssignmentBriefUploadForm } from "@/components/assignment-templates/upload-form";
import { adminUploadAssignmentBrief } from "@/app/dashboard/admin/assignment-briefs/actions";
import { RoomHead } from "@/components/room-head";

export default async function AdminAssignmentBriefsPage() {
  const admin = await requireRole("admin");
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("assignment_templates")
    .select("*")
    // single-centre: per-centre brief wording; a branch owns its own
    .eq("center_id", admin.center_id);

  const templateByType = new Map((templates ?? []).map((t) => [t.assignment_type, t]));
  const proseCount = (templates ?? []).filter((t) => t.format === "prose").length;
  // Handbook June 2025 9.2.1 -- at least two, not exactly two. See the
  // detail page for why the syllabus's wording does not govern here.
  const formatWarning =
    (templates ?? []).length === 4 && proseCount < 2
      ? `The Handbook needs at least two of the four briefs in continuous prose -- currently ${proseCount}.`
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Reachable from Settings' own nav, and directly from the Centre
          material panel now too (dashboard/admin/page.tsx) -- a real way
          back either way. */}
      <RoomHead
        back={{ href: "/dashboard/admin", label: "Course administration" }}
        eyebrow="Course admin &middot; Assignment briefs"
        title="Assignment Briefs"
        lede="Upload your centre's own brief for each written assignment as a PDF -- Claude splits it into sections you can review and edit before publishing it to trainees."
      />
      {formatWarning ? (
        <p className="rounded-[6px] border border-status-warning-text/40 bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text">
          {formatWarning}
        </p>
      ) : null}

      {ASSIGNMENT_ORDER.map((type, index) => {
        const template = templateByType.get(type);
        return (
          <div key={type} className={`card p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[17px] font-semibold text-ink">{ASSIGNMENT_INFO[type].title}</h2>
              {template ? (
                <span className="text-sm text-muted">{template.published_at ? "Published" : "Draft"}</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">{ASSIGNMENT_INFO[type].description}</p>

            {template ? (
              <Link
                href={`/dashboard/admin/assignment-briefs/${template.id}`}
                className="wash mt-3 inline-block rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
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
