"use client";

import { useState } from "react";

interface Material {
  id: string;
  name: string;
  url: string;
  sizeLabel: string | null;
}

// Ramy, 25 Aug 2026, after seeing every file listed open on the card face:
// "I don't wanna a thick pill. I want an average size pill that will show
// the teacher name, TP number, and the topic of the lesson... they click,
// and then the handouts are inside." Resting state is compact -- teacher +
// TP + topic only, same weight as a real pill, not a file-listing box.
// Files themselves stay hidden until clicked, same click-to-reveal pattern
// ClassMaterialsLink already uses for the table's own per-row link.
export function LessonMaterialsCard({
  teacherName,
  label,
  topic,
  materials,
}: {
  teacherName: string;
  label: string;
  topic: string | null;
  materials: Material[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="admin-hover-fill flex w-full flex-col items-start gap-0.5 rounded-[10px] border border-border px-3.5 py-2.5 text-left"
      >
        <p className="text-[13px] font-semibold text-ink">
          {label} — {teacherName}
        </p>
        {topic ? <p className="truncate text-[11px] text-muted">{topic}</p> : null}
      </button>
      {open ? (
        <div className="absolute left-0 z-10 mt-1.5 flex w-full min-w-[220px] flex-col gap-1 rounded-[8px] border border-border bg-card p-2 shadow-lg">
          {materials.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 truncate rounded-[6px] px-2 py-1.5 text-left text-xs text-ink admin-hover-fill"
            >
              <span className="truncate">{m.name}</span>
              {m.sizeLabel ? <span className="shrink-0 text-[11px] text-muted">{m.sizeLabel}</span> : null}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
