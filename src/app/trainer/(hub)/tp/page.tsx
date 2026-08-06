import Link from "next/link";
import { Library, Repeat } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

// Teaching Practice landing -- merges the two previously-separate tabs
// (TP Rotation / TP Points Library) into one, per Ramy's explicit ask (6
// Aug 2026): "one tab for both, but two cards... you click on the card,
// and it opens everything inside it." Reuses the exact Resource Hub card
// pattern already traced off Lovable (icon square + title + description +
// badge), not a new layout -- each card is a plain summary, the real
// content stays on the existing /coursebooks and /rotation pages this
// links into (no content duplicated or rebuilt here).
export default async function TeachingPracticePage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();

  const [{ data: coursebooks }, { data: schedule }] = await Promise.all([
    supabase.from("tp_coursebooks").select("id").eq("center_id", trainer.center_id),
    trainer.course_id
      ? supabase.from("course_tp_schedule").select("tp_number").eq("course_id", trainer.course_id)
      : Promise.resolve({ data: [] }),
  ]);

  const coursebookIds = (coursebooks ?? []).map((c) => c.id);
  const { count: publishedPointCount } =
    coursebookIds.length > 0
      ? await supabase
          .from("tp_points")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .in("tp_coursebook_id", coursebookIds)
      : { count: 0 };

  const coursebookCount = coursebookIds.length;
  const scheduledCount = new Set((schedule ?? []).map((s) => s.tp_number)).size;

  const cards = [
    {
      href: "/trainer/coursebooks",
      icon: Library,
      title: "TP Points Library",
      description: "Upload coursebooks and manage the reusable bank of TP points, tiered by density band.",
      badge: `${coursebookCount ?? 0} coursebook${coursebookCount === 1 ? "" : "s"} · ${publishedPointCount ?? 0} published points`,
    },
    {
      href: "/trainer/rotation",
      icon: Repeat,
      title: "TP Rotation",
      description: "Schedule which coursebook feeds each TP number, and assign points to trainee subgroups.",
      badge: `${scheduledCount} of ${TP_NUMBERS.length} TPs scheduled`,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-xl text-ink">Teaching Practice</h1>
        <p className="mt-1 text-sm text-muted">The content bank and the per-course schedule that draws from it.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="sheet group flex h-full gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
              <card.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm leading-snug text-ink">{card.title}</span>
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  Open →
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{card.description}</span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-block rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                  {card.badge}
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
