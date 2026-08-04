import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_CATEGORY_ORDER, RESOURCE_TYPE_ICON, RESOURCE_TYPE_LABELS } from "@/lib/resource-info";
import { ResourceComposer } from "@/app/portfolio/[traineeId]/resources/resource-composer";
import { deleteResource } from "@/app/portfolio/[traineeId]/resources/actions";

// §5 -- Resource Hub, a genuinely new feature (the pre-existing `resources`
// table had zero UI anywhere). Starts empty by design -- no seeded content,
// admins/trainers add real center material over time via the composer
// below. A resource is either course-specific or center-wide
// (course_id null, "share across the whole center").
export default async function ResourceHubPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const isEditableStaff = viewer?.role === "trainer" || viewer?.role === "admin";
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("center_id, course_id").eq("id", traineeId).maybeSingle();
  if (!trainee) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const query = supabase
    .from("resources")
    .select("*")
    .eq("center_id", trainee.center_id)
    .order("created_at", { ascending: false });
  const { data: resourcesRaw } = trainee.course_id
    ? await query.or(`course_id.eq.${trainee.course_id},course_id.is.null`)
    : await query.is("course_id", null);

  const resources = resourcesRaw ?? [];
  const byCategory = new Map<string, typeof resources>();
  for (const r of resources) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">Resource Hub</h2>
        <p className="text-xs text-muted">{resources.length} items</p>
      </div>

      {isEditableStaff ? <ResourceComposer traineeId={traineeId} /> : null}

      {resources.length === 0 ? (
        <p className="sheet text-sm text-muted">No resources yet.</p>
      ) : (
        RESOURCE_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => (
          <div key={category}>
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              {RESOURCE_CATEGORY_LABELS[category]}
            </h3>
            <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {byCategory.get(category)!.map((resource) => (
                <li key={resource.id}>
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sheet group flex h-full gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-base">
                      {RESOURCE_TYPE_ICON[resource.resource_type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm leading-snug text-ink">{resource.title}</span>
                        <span aria-hidden="true" className="mt-0.5 shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                          Open →
                        </span>
                      </span>
                      {resource.description ? (
                        <span className="mt-1 block text-xs leading-relaxed text-muted">{resource.description}</span>
                      ) : null}
                      <span className="mt-2 inline-block rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                        {RESOURCE_TYPE_LABELS[resource.resource_type]}
                      </span>
                    </span>
                  </a>
                  {isEditableStaff ? (
                    <form action={deleteResource} className="mt-1">
                      <input type="hidden" name="resource_id" value={resource.id} />
                      <input type="hidden" name="trainee_id" value={traineeId} />
                      <button type="submit" className="text-xs text-destructive hover:underline">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
