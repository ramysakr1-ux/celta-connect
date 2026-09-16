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
  const everyoneSigned = candidates.length > 0 && signed === candidates.length;

  // Polish pass §2: once everybody has handed a form in, the chip cloud is a
  // wall of identical teal saying one thing. It collapses to that one thing.
  // Computed from the records, not a toggle -- the day somebody withdraws
  // consent it opens itself back up, which a remembered switch would not do.
  if (everyoneSigned) {
    return (
      <div className="sheet flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <span className="flex items-center gap-2.5 text-body" style={{ color: "oklch(32% 0.05 195)" }}>
          <span className="block size-1.5 shrink-0 rounded-full bg-current" />
          <span className="font-semibold">Everyone has signed</span>
          <span className="text-muted">· filming can go ahead</span>
        </span>
        <a href="/api/filming-consent.pdf" className="text-meta font-semibold text-primary hover:underline">
          Download blank form
        </a>
      </div>
    );
  }

  return (
    <div className="sheet flex flex-wrap items-center gap-4 px-6 py-4">
      <div
        className="flex min-w-[220px] flex-col gap-0.5"
        title="Signed forms are on paper, kept with the class register -- this just tracks who's handed one in."
      >
        <span className="text-label font-bold tracking-[0.1em] text-muted uppercase">Filming consent</span>
        <span className="text-meta text-muted">
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
              className="wash inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-meta font-medium"
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
