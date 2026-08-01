import Link from "next/link";
import type { Database } from "@/lib/supabase/types";

type Coursebook = Database["public"]["Tables"]["tp_coursebooks"]["Row"];

const STATUS_LABEL: Record<Coursebook["generation_status"], string> = {
  pending: "Not generated yet",
  processing: "Generating...",
  completed: "Generated",
  failed: "Generation failed",
};

export function CoursebookList({
  coursebooks,
  basePath,
}: {
  coursebooks: Coursebook[];
  basePath: string;
}) {
  if (coursebooks.length === 0) {
    return <p className="text-muted">No coursebooks uploaded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {coursebooks.map((cb) => (
        <Link
          key={cb.id}
          href={`${basePath}/${cb.id}`}
          className="card-interactive flex items-center justify-between p-4"
        >
          <div>
            <span className="text-ink">{cb.title}</span>
            <span className="ml-2 text-sm text-muted">{cb.level}</span>
          </div>
          <span className="text-sm text-muted">{STATUS_LABEL[cb.generation_status]}</span>
        </Link>
      ))}
    </div>
  );
}
