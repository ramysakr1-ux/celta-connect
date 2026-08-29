// Page 1 -- the booklet's cover.
//
// Ramy, 29 Aug 2026: "where is the front page?" It was missing outright:
// the app opened on the progress overview, and his file opens on this.
// Everything here except the ULN is already known to Connect, so the
// fields print filled rather than blank -- the paper cover is something a
// candidate copies out by hand, and there is no reason to make them.

export interface CoverData {
  candidateName: string | null;
  centreName: string | null;
  centreNumber: string | null;
  courseNumber: string | null;
  courseDates: string | null;
  tutors: string[];
  uln: string | null;
}

// The centre number prints as separate boxes on the form, one character
// each, so it reads as the same field an assessor is used to checking.
function Boxes({ value, count }: { value: string | null; count: number }) {
  const chars = (value ?? "").replace(/\s/g, "").slice(0, count).split("");
  return (
    <span className="inline-flex gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center text-[12px] font-semibold text-ink"
          style={{
            width: 22,
            height: 26,
            borderRadius: 4,
            background: "oklch(94.5% 0.02 85)",
            border: "1px solid oklch(83% 0.024 85)",
          }}
        >
          {chars[i] ?? " "}
        </span>
      ))}
    </span>
  );
}

export function BookletCover({ data }: { data: CoverData }) {
  return (
    <>
      <div className="flex items-center gap-3" style={{ marginBottom: 26 }}>
        <span
          className="text-[22px] font-bold"
          style={{ background: "oklch(38% 0.072 195)", color: "#fff", padding: "5px 22px 5px 12px", borderRadius: 6 }}
        >
          Cambridge
        </span>
        <span className="font-serif text-[22px] text-ink">English Teaching</span>
      </div>

      <p className="text-[13px] font-bold text-ink" style={{ marginBottom: 4 }}>
        Certificate in Teaching English to Speakers of Other Languages
      </p>
      <p className="font-serif text-ink" style={{ fontSize: 40, fontWeight: 700, margin: "8px 0" }}>
        CELTA
      </p>
      <p className="text-[14px] font-bold text-ink" style={{ marginBottom: 22 }}>
        Candidate Record Booklet CELTA 5
      </p>

      {/* Ramy, 30 Aug 2026: "I want to remove that part -- candidate name,
          dates, centre, tutors, course. The cover page should start with the
          Cambridge logo."

          On paper those blanks exist because the candidate fills them in. On
          screen the app already knows every one of them, and the header above
          this booklet carries the candidate's name on every page, so printing
          them again was a form pretending to be a form. The ULN stays: it is
          the one identifier Connect does not hold and a candidate may still
          need to supply. */}
      <p className="flex flex-wrap items-center gap-2.5 text-[12px]" style={{ marginBottom: 8 }}>
        <span>Unique Learner Number ULN:</span>
        <Boxes value={data.uln} count={10} />
      </p>
      <p className="text-[10px] leading-relaxed text-muted" style={{ marginBottom: 16 }}>
        ULN is a 10-digit identifier which is applied, where required, to the Personal Learning Record of anyone over
        the age of 14 involved in UK education or training.
      </p>

      <p className="text-[11px] font-bold text-ink" style={{ marginBottom: 8 }}>
        This booklet has to be submitted during the course and at the end of the course for assessment purposes.
      </p>
      <p className="text-[10px] leading-relaxed text-muted">
        To assist Cambridge English in conducting research and validation of teaching qualifications, please complete
        the electronic candidate information sheet{" "}
        <a href="https://www.formstack.com/forms/?1473128-TRtl9Pz1V3" target="_blank" rel="noreferrer">
          here
        </a>
        .
      </p>

      {/* Ramy, 30 Aug 2026: "we also need to find somewhere kind of subtle
          where we write that this is July 2023." Which edition this
          reproduces is the first thing an assessor checks if a form looks
          wrong to them, so it says so -- quietly, at the foot of the cover,
          where a printed edition line goes. Source of truth is
          src/lib/celta5-replica-pdf/assets/celta5-master-july-2023.pdf. */}
      <p className="text-[9.5px] text-muted" style={{ marginTop: 22, letterSpacing: "0.03em" }}>
        Reproduces the Cambridge Candidate Record Booklet CELTA 5, July 2023 edition.
      </p>
    </>
  );
}
