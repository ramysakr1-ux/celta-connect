import { toggleFilmingConsent } from "@/app/trainer/(hub)/roster/filming-consent-actions";

export interface ConsentCandidate {
  id: string;
  name: string;
  confirmed: boolean;
}

// specs/admissions-and-close-out.md §10 -- "only used if a centre films."
// design_handoff_trainer_roster, "Filming consent card": label + count on
// the left, one pill per active candidate on the right; signed = teal
// tint, not signed = dashed warn. Clicking a pill toggles the record.
export function FilmingConsentCard({ candidates }: { candidates: ConsentCandidate[] }) {
  const signed = candidates.filter((c) => c.confirmed).length;
  return (
    <div className="sheet flex flex-wrap items-center gap-4 px-6 py-4">
      <div
        className="flex min-w-[220px] flex-col gap-0.5"
        title="Signed forms are on paper, kept with the class register -- this just tracks who's handed one in."
      >
        <span className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Filming consent</span>
        <span className="text-[12.5px] text-muted">
          {signed} of {candidates.length} handed in ·{" "}
          <a href="/api/filming-consent.pdf" className="font-semibold text-primary hover:underline">
            Download blank form
          </a>
        </span>
      </div>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {candidates.map((c) => (
          <form key={c.id} action={toggleFilmingConsent}>
            <input type="hidden" name="trainee_id" value={c.id} />
            <input type="hidden" name="confirmed" value={c.confirmed ? "false" : "true"} />
            <button
              type="submit"
              title={`${c.name} -- ${c.confirmed ? "click to mark as not yet collected" : "click to mark as collected"}`}
              className="trainer-hover inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium"
              style={
                c.confirmed
                  ? { background: "oklch(93% 0.019 190)", color: "oklch(32% 0.05 195)", borderColor: "transparent" }
                  : { borderStyle: "dashed", borderColor: "var(--color-status-warning-text)", color: "var(--color-status-warning-text)" }
              }
            >
              <span className="block size-1.5 rounded-full bg-current" />
              {c.name.split(" ")[0]}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
