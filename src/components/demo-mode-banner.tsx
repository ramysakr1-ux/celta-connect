// "Flagged clone of the real app" -- build-spec.md build order #21. Shown
// on every page the seeded demo trainer session reaches, so it's never
// mistaken for a real centre's data. The actual read-only guarantee is
// enforced at the database layer (migration 0079's trigger); this is just
// the visible label for it.
export function DemoModeBanner() {
  return (
    <div className="border-b border-gold/30 bg-gold/10 px-4 py-2 text-center text-xs text-ink">
      You&apos;re exploring a shared demo with sample data. Changes you make here aren&apos;t saved.
    </div>
  );
}
