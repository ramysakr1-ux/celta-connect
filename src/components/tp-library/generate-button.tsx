"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface SiblingCoursebook {
  id: string;
  title: string;
}

export function GenerateButton({
  coursebookId,
  siblingCoursebooks = [],
  defaultAvoidIds = [],
}: {
  coursebookId: string;
  siblingCoursebooks?: SiblingCoursebook[];
  defaultAvoidIds?: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avoidIds, setAvoidIds] = useState<string[]>(defaultAvoidIds);

  function toggleAvoid(id: string) {
    setAvoidIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleClick() {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/coursebooks/${coursebookId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avoidRepeatOfIds: avoidIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {siblingCoursebooks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted">
            Avoid repeating material from these other sets (unchecking generates a fresh set that may overlap):
          </p>
          <ul className="flex flex-col gap-1">
            {siblingCoursebooks.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  id={`avoid-${s.id}`}
                  checked={avoidIds.includes(s.id)}
                  onChange={() => toggleAvoid(s.id)}
                />
                <label htmlFor={`avoid-${s.id}`}>{s.title}</label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-2 self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-card border-t-transparent"
            />
            Generating... (this can take a minute or two)
          </>
        ) : (
          "Generate TP points"
        )}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
