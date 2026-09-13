import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { AssignmentGenerateButton } from "@/components/assignment-templates/generate-button";
import { SectionEditor } from "@/components/assignment-templates/section-editor";
import {
  publishAssignmentTemplate,
  unpublishAssignmentTemplate,
  updateAssignmentTemplateSections,
} from "@/app/dashboard/admin/assignment-briefs/actions";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { countSubmissionsAgainstBrief } from "@/lib/assignment-brief";
import { holdsCentre } from "@/lib/branch-scope";

export default async function AdminAssignmentBriefDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publish_error?: string }>;
}) {
  const admin = await requireRole("admin");
  const { id } = await params;
  const { publish_error } = await searchParams;
  const supabase = await createClient();

  const { data: template } = await supabase.from("assignment_templates").select("*").eq("id", id).maybeSingle();

  if (!template || !(await holdsCentre(admin, template.center_id))) {
    notFound();
  }

  const { data: allTemplates } = await supabase
    .from("assignment_templates")
    .select("id, format")
    // single-centre: per-centre brief wording; a branch owns its own
    .eq("center_id", admin.center_id);
  const proseCount = (allTemplates ?? []).filter((t) => t.format === "prose").length;
  // Handbook June 2025 9.2.1: "At least two of the assignments should be
  // written in continuous prose." This read `!== 2` until 13 Sep 2026, which
  // also refused a centre that had made THREE prose -- allowed by the
  // Handbook, and the newer, more specific document wins over the syllabus's
  // looser "two of the assignments must be written in academic prose."
  const formatWarning =
    (allTemplates ?? []).length === 4 && proseCount < 2
      ? `The Handbook needs at least two of the four briefs in continuous prose -- this centre currently has ${proseCount}.`
      : null;

  // What an editor is about to leave behind. A brief edit is versioned now
  // (migration 0300), so this is information rather than a warning -- but a
  // tutor changing the question mid-course should see who has already
  // answered the old one.
  const pinnedSubmissions = await countSubmissionsAgainstBrief(supabase, admin.center_id, template.assignment_type);

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">{ASSIGNMENT_INFO[template.assignment_type].title}</h1>
        <p className="mt-2 text-muted">Status: {template.generation_status}</p>
        {pinnedSubmissions > 0 ? (
          <p
            className="mt-2 rounded-[6px] px-3 py-2 text-sm"
            style={{ background: "color-mix(in oklab, oklch(44% 0.095 68) 10%, transparent)", color: "oklch(44% 0.095 68)" }}
          >
            {pinnedSubmissions === 1 ? "One candidate has" : `${pinnedSubmissions} candidates have`} already submitted
            against this brief. Editing the sections publishes a NEW version: what they handed in keeps the brief they
            answered, and anyone still writing moves to the new one with their own words carried across.
          </p>
        ) : null}

        {publish_error === "format_count" ? (
          <p className="mt-2 rounded-[6px] border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Can&apos;t publish -- the centre&apos;s four briefs need at least two in continuous prose. Adjust a
            brief&apos;s format before publishing this one.
          </p>
        ) : null}
        {template.generation_error ? <p className="mt-2 text-sm text-destructive">{template.generation_error}</p> : null}
        {template.generation_status === "pending" || template.generation_status === "failed" ? (
          <div className="mt-4">
            <AssignmentGenerateButton templateId={template.id} />
          </div>
        ) : null}
      </div>

      {template.generation_status === "completed" ? (
        <div className="card card-garnet p-6">
          <h2 className="font-serif text-lg text-ink">Sections</h2>
          <p className="mt-1 text-sm text-muted">
            Edit the titles and instruction text as needed, then publish -- trainees only see the
            published version.
          </p>
          <div className="mt-4">
            <SectionEditor
              templateId={template.id}
              sections={template.sections}
              format={template.format}
              formatWarning={formatWarning}
              publishedAt={template.published_at}
              saveAction={updateAssignmentTemplateSections}
              publishAction={publishAssignmentTemplate}
              unpublishAction={unpublishAssignmentTemplate}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
