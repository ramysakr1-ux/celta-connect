import type { TpDensityTier } from "@/lib/supabase/types";
import type {
  CoachingProseProcedure,
  FrameworkProcedure,
  ScriptedProcedure,
} from "@/lib/tp-density";

// Renders the tier-appropriate shape of a generated/assigned procedure as
// readable text -- a raw JSON dump is a debug view, not something a
// trainer or trainee should have to parse to review a lesson.
export function ProcedureDisplay({
  tier,
  procedure,
}: {
  tier: TpDensityTier;
  procedure: unknown;
}) {
  if (!procedure || tier === "minimal") {
    return null;
  }

  if (tier === "scripted") {
    const { stages } = procedure as ScriptedProcedure;
    return (
      <ul className="list-disc space-y-3 pl-5">
        {(stages ?? []).map((stage, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium text-ink">{stage.name}</span>
            {stage.timing ? <span className="ml-2 text-xs text-muted">{stage.timing}</span> : null}
            <p className="mt-1 text-muted">{stage.instructions}</p>
          </li>
        ))}
      </ul>
    );
  }

  if (tier === "framework") {
    const { framework_name, stages, analysis_label, analysis_prompt } =
      procedure as FrameworkProcedure;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">
          <span className="text-muted">Framework: </span>
          {framework_name}
        </p>
        <ul className="list-disc space-y-2 pl-5">
          {(stages ?? []).map((stage, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-ink">{stage.name}</span>
              <p className="mt-0.5 text-muted">{stage.reference}</p>
            </li>
          ))}
        </ul>
        {analysis_label ? (
          <p className="text-sm text-ink">
            <span className="text-muted">{analysis_label}: </span>
            {analysis_prompt}
          </p>
        ) : null}
      </div>
    );
  }

  // coaching_prose
  const { guidance_paragraphs } = procedure as CoachingProseProcedure;
  return (
    <ul className="list-disc space-y-2 pl-5">
      {(guidance_paragraphs ?? []).map((paragraph, i) => (
        <li key={i} className="text-sm text-muted">
          {paragraph}
        </li>
      ))}
    </ul>
  );
}
