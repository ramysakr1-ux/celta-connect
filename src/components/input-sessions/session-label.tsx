// The label above a block inside an input session: "Warmer · 5 minutes",
// "Discuss first · 5 minutes", "Match the drill to the problem · 10 minutes".
//
// Remainder pass B9 (16 Sep 2026): these were written inline in every session,
// at two different sizes -- and in `drilling-techniques` and `language-practice`
// both sizes appeared in the same file, so two blocks of the same kind, on the
// same page, announced themselves differently. One component, one size.
export function SessionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-label font-bold text-ink">{children}</p>;
}
