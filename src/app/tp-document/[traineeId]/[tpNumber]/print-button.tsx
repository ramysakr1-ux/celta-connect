"use client";

// The assembled document owns its own @page rules, so printing is the
// browser's own print dialogue -- "Save as PDF" there produces the file.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[8px] px-4 py-2 text-sm font-semibold"
      style={{ background: "oklch(37.5% 0.058 195)", color: "oklch(98.5% 0.006 90)" }}
    >
      Print or save as PDF
    </button>
  );
}
