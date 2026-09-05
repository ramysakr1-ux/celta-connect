import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { AssignmentGenerateButton } from "@/components/assignment-templates/generate-button";
import { SectionEditor } from "@/components/assignment-templates/section-editor";
import {
  publishAssignmentTemplate,
  unpublishAssignmentTemplate,
  updateAssignmentTemplateSections,
} from "@/app/trainer/(hub)/assignment-briefs/actions";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";

export default async function TrainerAssignmentBriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const trainer = await requireRole("trainer");
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase.from("assignment_templates").select("*").eq("id", id).maybeSingle();

  if (!template || template.center_id !== trainer.center_id) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">{ASSIGNMENT_INFO[template.assignment_type].title}</h1>
        <p className="mt-2 text-muted">Status: {template.generation_status}</p>
        {template.generation_error ? <p className="mt-2 text-sm text-destructive">{template.generation_error}</p> : null}
        {template.generation_status === "pending" || template.generation_status === "failed" ? (
          <div className="mt-4">
            <AssignmentGenerateButton templateId={template.id} />
          </div>
        ) : null}
      </div>

      {template.generation_status === "completed" ? (
        <div className="card p-6">
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
              formatWarning={null}
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
