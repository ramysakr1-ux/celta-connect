"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton({ coursebookId }: { coursebookId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/coursebooks/${coursebookId}/generate`, {
        method: "POST",
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
    <div className="flex flex-col gap-2">
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
