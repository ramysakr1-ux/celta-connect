import Link from "next/link";

// Shown only to someone who is signed in AND holding an assessor link, which
// in practice means a tutor checking what the assessor sees. A real assessor
// has no session and never renders this.
//
// It exists because the assessor view now wins over the signed-in one: worth
// saying why the page looks different, and worth giving a way back.
export function AssessorViewNotice() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[6px] border border-gold/40 bg-gold/10 px-4 py-2.5">
      <span className="text-[11px] font-bold tracking-[0.08em] text-gold uppercase">Assessor view</span>
      <span className="text-[12px] text-ink">
        You have an assessor link open, so you are seeing this candidate exactly as the assessor does.
      </span>
      <Link
        href="/assessor/exit"
        prefetch={false}
        className="ml-auto rounded-[6px] border border-border bg-card px-3 py-1 text-[11.5px] font-medium text-ink trainer-hover-fill"
      >
        Leave assessor view
      </Link>
    </div>
  );
}
