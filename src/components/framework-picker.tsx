"use client";

import { LESSON_FRAMEWORKS } from "@/lib/tp-plan-content";
import { CustomSelect } from "@/components/custom-select";

export function FrameworkPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      placeholder="Choose a framework"
      options={LESSON_FRAMEWORKS.map((f) => ({ value: f.name, label: f.name }))}
    />
  );
}
