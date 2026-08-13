"use client";

import { ResourceComposer } from "@/app/portfolio/[traineeId]/resources/resource-composer";
import { deleteResource } from "@/app/portfolio/[traineeId]/resources/actions";
import { ResourceContentLink } from "@/components/resource-content-link";
import { RESOURCE_TYPE_ICON, RESOURCE_TYPE_LABELS } from "@/lib/resource-info";
import type { Database, ResourceCategory } from "@/lib/supabase/types";

type Resource = Database["public"]["Tables"]["resources"]["Row"];

// Shared by Input sessions and Centre documents on the trainer's Resource
// hub landing page -- the two genuinely new, resources-table-backed
// sections (everything else on that page links out to an existing,
// already-built page instead).
export function ResourceCategoryManager({
  category,
  centerId,
  resources,
}: {
  category: ResourceCategory;
  centerId: string;
  resources: Resource[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <ResourceComposer traineeId={null} centerId={centerId} fixedCategory={category} />
      {resources.length === 0 ? (
        <p className="sheet border-dashed text-sm text-muted">Nothing here yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((r) => {
            const Icon = RESOURCE_TYPE_ICON[r.resource_type];
            return (
              <li key={r.id} className="sheet flex h-full flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <ResourceContentLink title={r.title} fileUrl={r.file_url} storagePath={r.storage_path} contentType={r.content_type} />
                    {r.description ? <p className="mt-1 text-xs leading-relaxed text-muted">{r.description}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-block rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                        {RESOURCE_TYPE_LABELS[r.resource_type]}
                      </span>
                      {!r.visible_to_trainee ? (
                        <span className="inline-block rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                          Trainer only
                        </span>
                      ) : null}
                      {!r.course_id ? (
                        <span className="inline-block rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                          Centre-wide
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <form action={deleteResource}>
                  <input type="hidden" name="resource_id" value={r.id} />
                  <button type="submit" className="text-xs text-destructive hover:underline">
                    Remove
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
