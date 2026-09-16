// Which branch a row belongs to (centre side B7, 16 Sep 2026).
//
// "The branch always travels with the course code" -- a code is ambiguous
// across two cities, so it never appears alone. Four rooms said it four
// ways: a pill on the Centre overview's course rows, bare 11px muted text on
// Course Admin's and Admissions' rows, a bare column on the owner's "Who
// holds what". One shape now, the overview's, so a branch name never reads
// as part of the sentence beside it.
//
// Renders nothing without a name, so a caller can pass a lookup straight in
// and single-branch centres stay quiet.
export function BranchChip({ name, className = "" }: { name: string | null | undefined; className?: string }) {
  if (!name) return null;
  return (
    <span className={`rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-muted ${className}`}>
      {name}
    </span>
  );
}
