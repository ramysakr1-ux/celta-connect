import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getMarkingGuidance } from "@/lib/marking-guidance";
import { ASSIGNMENT_ORDER, ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { ASSIGNMENT_CRITERIA } from "@/lib/assignment-criteria";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";
import { MarkingGuidanceTabs, type SerializedGuidance } from "@/app/dashboard/trainer/marking-guidance/tabs";

// design_handoff_teaching_and_assignments/assignments -- "Marking guidance
// lives inside Marking Guidance.dc.html itself -- there's no separate
// location for it." Five tabs: the four Cambridge assignments plus the
// plagiarism reflection, which the design's own mockup gives a fifth tab
// and its own criteria (there is no Cambridge rubric to standardise there,
// but centres still disagree about what "an honest account" looks like).
const TAB_ORDER: AssignmentTypeValue[] = [...ASSIGNMENT_ORDER, "Plagiarism Reflection"];

export default async function MarkingGuidancePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const trainer = await requireRole("trainer");
  const supabase = await createClient();
  const { type } = await searchParams;

  const guidanceMap = await getMarkingGuidance(supabase, trainer.center_id);
  const guidance: SerializedGuidance = {};
  for (const [assignmentType, byKey] of guidanceMap) {
    guidance[assignmentType] = {};
    for (const [key, row] of byKey) {
      guidance[assignmentType][key] = row;
    }
  }

  const updatedByIds = [...new Set([...guidanceMap.values()].flatMap((byKey) => [...byKey.values()].map((r) => r.updated_by).filter((id): id is string => Boolean(id))))];
  const { data: updaters } = updatedByIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", updatedByIds) : { data: [] };
  const updaterNameById = Object.fromEntries((updaters ?? []).map((u) => [u.id, u.full_name]));

  const assignments = TAB_ORDER.map((t) => ({
    type: t,
    title: ASSIGNMENT_INFO[t].title,
    criteria: ASSIGNMENT_CRITERIA[t],
  }));

  const initialType = type && (TAB_ORDER as string[]).includes(type) ? type : TAB_ORDER[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-2 p-6">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Marking guidance</p>
        <h1 className="font-serif text-2xl text-ink">There is no answer key. There is a line.</h1>
        <p className="max-w-2xl text-sm text-muted">
          An assignment has many right answers, which is why two tutors can mark the same script differently. This
          page is where this centre writes down where the line sits for each criterion — agreed at standardisation,
          kept beside the criterion while marking. Not from Cambridge, not from Connect: every line here is this
          centre&apos;s own. Tutors and the assessor see this; candidates never do.
        </p>
      </div>

      <MarkingGuidanceTabs assignments={assignments} guidance={guidance} updaterNameById={updaterNameById} initialType={initialType} />
    </div>
  );
}
