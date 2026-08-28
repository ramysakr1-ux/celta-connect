"use client";

import { useState } from "react";
import { togglePreCourseTaskSection } from "@/app/portfolio/[traineeId]/pre-course-task/actions";
import { TaskAnswerBox } from "@/app/portfolio/[traineeId]/pre-course-task/task-answer-box";
import { parseTaskShape, responseIsAnswered } from "@/lib/pre-course-task-shape";
import type { Database } from "@/lib/supabase/types";

type Section = Database["public"]["Tables"]["pre_course_task_sections"]["Row"];
type Item = Database["public"]["Tables"]["pre_course_task_items"]["Row"];

function SectionCard({
  section,
  items,
  done,
  answerKeyUnlocked,
  isEditable,
  responsesByItemId,
}: {
  section: Section;
  items: Item[];
  done: boolean;
  answerKeyUnlocked: boolean;
  isEditable: boolean;
  responsesByItemId: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const answered = items.filter((i) => responseIsAnswered(responsesByItemId.get(i.id))).length;

  return (
    <div className={`sheet flex flex-col gap-3 border-l-4 ${done ? "border-l-primary" : "border-l-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{section.title}</p>
          {items.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted">
              {answered} of {items.length} answered
            </p>
          ) : null}
        </div>
        {isEditable ? (
          <form action={togglePreCourseTaskSection}>
            <input type="hidden" name="section_id" value={section.id} />
            <button
              type="submit"
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                done ? "bg-primary text-primary-foreground" : "border border-border text-muted trainee-hover-fill"
              }`}
            >
              {done ? "Done" : "Mark done"}
            </button>
          </form>
        ) : done ? (
          <span className="pill pill-success shrink-0">Done</span>
        ) : (
          <span className="shrink-0 text-xs text-muted">Not done yet</span>
        )}
      </div>

      {section.prompt ? <p className="whitespace-pre-wrap text-sm text-muted">{section.prompt}</p> : null}

      {items.length > 0 ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="self-start text-xs font-semibold text-primary hover:underline">
          {open ? "Hide the tasks" : isEditable ? "Answer the tasks" : "Read the tasks"}
        </button>
      ) : null}

      {open ? (
        <div className="flex flex-col divide-y divide-border-faint">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
              {/* The reading that precedes this task in the Cambridge
                  document -- deliberately muted and set off by a rule, so
                  it reads as context rather than as part of the question
                  the candidate is answering. */}
              {item.lead_in ? (
                <p className="mb-1 whitespace-pre-wrap border-l-2 border-border pl-3 text-[13px] leading-relaxed text-muted">{item.lead_in}</p>
              ) : null}
              {item.task_number ? <p className="text-xs font-semibold text-ink">Task {item.task_number}</p> : null}
              <p className="whitespace-pre-wrap text-sm text-ink">{item.prompt}</p>
              <TaskAnswerBox
                itemId={item.id}
                initialResponse={responsesByItemId.get(item.id) ?? ""}
                readOnly={!isEditable}
                shape={parseTaskShape(item.shape)}
              />
              {answerKeyUnlocked ? (
                item.answer ? (
                  <p className="mt-1 whitespace-pre-wrap rounded-[6px] border border-border-faint bg-accent/20 px-3 py-2 text-sm text-ink">
                    <span className="font-semibold text-primary">Answer — </span>
                    {item.answer}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted">No fixed answer for this one -- it's a reflection task.</p>
                )
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SectionGroup({
  title,
  note,
  sections,
  itemsBySection,
  completedSectionIds,
  answerKeyUnlocked,
  isEditable,
  responsesByItemId,
}: {
  title: string;
  note: string;
  sections: Section[];
  itemsBySection: Map<string, Item[] | undefined>;
  completedSectionIds: Set<string>;
  answerKeyUnlocked: boolean;
  isEditable: boolean;
  responsesByItemId: Map<string, string>;
}) {
  if (sections.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-serif text-lg text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">{note}</p>
      </div>
      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          items={itemsBySection.get(section.id) ?? []}
          done={completedSectionIds.has(section.id)}
          answerKeyUnlocked={answerKeyUnlocked}
          isEditable={isEditable}
          responsesByItemId={responsesByItemId}
        />
      ))}
    </div>
  );
}

export function PreCourseTaskSections({
  cambridgeSections,
  supplementSections,
  itemsBySection,
  completedSectionIds,
  answerKeyUnlocked,
  isEditable,
  responsesByItemId,
}: {
  cambridgeSections: Section[];
  supplementSections: Section[];
  itemsBySection: Map<string, Item[] | undefined>;
  completedSectionIds: Set<string>;
  answerKeyUnlocked: boolean;
  isEditable: boolean;
  responsesByItemId: Map<string, string>;
}) {
  // Progress is answered-tasks now, not sections-ticked -- the candidate
  // types their answers here, so the real measure is how much of the task
  // is actually written, not how many section headers they've flagged.
  const allSections = [...cambridgeSections, ...supplementSections];
  const allItems = allSections.flatMap((s) => itemsBySection.get(s.id) ?? []);
  const total = allItems.length;
  const done = allItems.filter((i) => responseIsAnswered(responsesByItemId.get(i.id))).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {done} of {total} answered
          </span>
          {answerKeyUnlocked ? <span className="font-semibold text-primary">Answer key open</span> : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border-faint">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }} />
        </div>
      </div>

      <SectionGroup
        title="Cambridge's Pre-Course Task"
        note="© UCLES 2018 -- the official task, unchanged."
        sections={cambridgeSections}
        itemsBySection={itemsBySection}
        completedSectionIds={completedSectionIds}
        answerKeyUnlocked={answerKeyUnlocked}
        isEditable={isEditable}
        responsesByItemId={responsesByItemId}
      />
      <SectionGroup
        title="Your centre's supplement"
        note="Written by your centre, not by Cambridge -- covers teaching online and using L1, which the 2018 task predates."
        sections={supplementSections}
        itemsBySection={itemsBySection}
        completedSectionIds={completedSectionIds}
        answerKeyUnlocked={answerKeyUnlocked}
        isEditable={isEditable}
        responsesByItemId={responsesByItemId}
      />
    </div>
  );
}
