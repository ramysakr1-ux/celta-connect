"use client";

import { chooseGtkyActivity } from "@/app/trainer/(hub)/gtky/actions";
import type { GtkyActivity } from "@/lib/gtky-activities";

// Deliberately no "reveals" field here -- that column stays in the
// tutor's copy. "Tell a candidate to watch for present perfect and they
// will run a grammar test with a smile on it."
export function GtkyPickForm({ activities, chosenSlug }: { activities: GtkyActivity[]; chosenSlug: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {activities.map((a) => {
        const isChosen = chosenSlug === a.slug;
        const locked = !!chosenSlug;
        return (
          <div
            key={a.slug}
            className={`flex flex-col gap-3 rounded-[8px] border p-5 ${isChosen ? "border-primary bg-primary/5" : "border-border bg-card"}`}
          >
            <div>
              <p className="font-serif text-lg text-ink">{a.name}</p>
              <p className="mt-1 text-xs text-muted">{a.meta}</p>
            </div>
            <ol className="flex flex-col gap-1.5">
              {a.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink">
                  <span className="text-muted">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {a.onlineNote ? (
              <p className="rounded-[6px] border border-gold/30 bg-gold/10 p-2.5 text-xs text-ink">
                <span className="font-semibold">Online: </span>
                {a.onlineNote}
              </p>
            ) : null}
            {locked ? (
              isChosen ? (
                <span className="mt-auto self-start rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  Your choice
                </span>
              ) : null
            ) : (
              <form action={chooseGtkyActivity} className="mt-auto">
                <input type="hidden" name="slug" value={a.slug} />
                <button
                  type="submit"
                  className="w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm font-medium text-ink hover:border-primary"
                >
                  Choose this one
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
