// The CELTA 5 booklet's structural primitives.
//
// Ramy, 29 Aug 2026, on why this screen reproduces the Cambridge document
// rather than reading like the rest of the app: "some assessors might
// complain that the CELTA 5 being used on the course does not resemble the
// original CELTA 5." The external assessor inspects this page on the visit
// in the final week -- not the end-of-course PDF, which goes to the centre
// and Cambridge afterwards -- so screen fidelity is what protects the
// centre from that conversation.
//
// Layout, spacing and section numbering follow his design file "CELTA 5
// Record (standalone).html" exactly. Don't restyle by eye; re-read the file.

export function BookletSection({
  num,
  title,
  children,
  id,
  frontMatter,
}: {
  num?: string;
  title?: string;
  children: React.ReactNode;
  id?: string;
  /**
   * Cover and contents. Ramy, 30 Aug 2026: "the third page is roles and
   * responsibilities, and this page should read page number one." So the
   * front matter is unnumbered, exactly as the printed booklet has it --
   * the counter starts on Section 1.
   */
  frontMatter?: boolean;
}) {
  return (
    <section id={id} className={`${frontMatter ? "c5-break-front" : "c5-break"} scroll-mt-6`}>
      {num ? <div className="c5-section-num">{num}</div> : null}
      {title ? <h2 className="c5-section-header">{title}</h2> : null}
      {children}
    </section>
  );
}

// A "pulled" tag marks a value the app filled in from the course record
// rather than something anyone typed into the booklet. The design uses it
// heavily and deliberately: it tells an assessor which figures are
// system-derived, which is exactly the question they would otherwise ask.
export function Pulled() {
  return <span className="c5-pulled">pulled</span>;
}

export function LockBox({ children }: { children: React.ReactNode }) {
  return <div className="c5-lockbox">{children}</div>;
}
