import { TaskAnswerBox } from "@/app/portfolio/[traineeId]/pre-course-task/task-answer-box";
import { parseTaskShape, responseIsAnswered } from "@/lib/pre-course-task-shape";
import type { Database } from "@/lib/supabase/types";

type Section = Database["public"]["Tables"]["pre_course_task_sections"]["Row"];
type Item = Database["public"]["Tables"]["pre_course_task_items"]["Row"];

// Ramy, 28 Aug 2026: "skip the middleman -- they click on their hero card,
// pre-course task, and they land right here, and they just start typing."
// Every section used to be a collapsed card behind an "Answer the tasks"
// toggle, so reaching an actual question took two clicks past the point the
// candidate had already asked to do the task. The worksheet is just open
// now; a section is a heading, not a door.
//
// The old per-section "Mark done" pill went with it. It was a second,
// competing definition of done -- progress counts tasks actually answered
// now, so a candidate could tick a section they hadn't written a word in
// and watch the two numbers disagree.
function TaskRow({ item, answerKeyUnlocked, isEditable, response }: { item: Item; answerKeyUnlocked: boolean; isEditable: boolean; response: string }) {
  const answered = responseIsAnswered(response);
  return (
    <div className="flex flex-col gap-1.5 py-4 first:pt-0">
      {/* The reading that precedes this task in the Cambridge document --
          muted and set off by a rule, so it reads as context rather than as
          part of the question being asked. */}
      {item.lead_in ? (
        <p className="mb-1 whitespace-pre-wrap border-l-2 border-border pl-3 text-[13px] leading-relaxed text-muted">{item.lead_in}</p>
      ) : null}
      <div className="flex items-baseline gap-2">
        {item.task_number ? <p className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">Task {item.task_number}</p> : null}
        {answered ? <span className="text-[11px] font-semibold text-primary">Answered</span> : null}
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink">{item.prompt}</p>
      <TaskAnswerBox itemId={item.id} initialResponse={response} readOnly={!isEditable} shape={parseTaskShape(item.shape)} />
      {/* Ramy, 28 Aug 2026: the cohort-wide date unlock alone used to be
          enough, because the task was answered on paper -- the key coming
          out couldn't touch work already written. Now the candidate types
          into this very screen, so an unlocked key printed under an empty
          box is just the answer, handed over before they think. The date
          gate still decides WHEN the key exists; answering the task is what
          reveals it. Staff and assessors (isEditable false) are unaffected
          -- they see everything, as they did before. */}
      {answerKeyUnlocked && (!isEditable || answered) ? (
        item.answer ? (
          <p className="mt-1 whitespace-pre-wrap rounded-[6px] border border-border-faint bg-accent/20 px-3 py-2 text-sm text-ink">
            <span className="font-semibold text-primary">Answer — </span>
            {item.answer}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">No fixed answer for this one -- it&apos;s a reflection task.</p>
        )
      ) : answerKeyUnlocked && item.answer ? (
        <p className="mt-1 text-xs text-muted">Answer your version first -- Cambridge&apos;s appears here once you do.</p>
      ) : null}
    </div>
  );
}

function SectionBlock({
  section,
  items,
  answerKeyUnlocked,
  isEditable,
  responsesByItemId,
}: {
  section: Section;
  items: Item[];
  answerKeyUnlocked: boolean;
  isEditable: boolean;
  responsesByItemId: Map<string, string>;
}) {
  const answered = items.filter((i) => responseIsAnswered(responsesByItemId.get(i.id))).length;

  return (
    <div className="sheet flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{section.title}</p>
        {items.length > 0 ? (
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {answered} of {items.length}
          </span>
        ) : null}
      </div>
      {section.prompt ? <p className="whitespace-pre-wrap text-sm text-muted">{section.prompt}</p> : null}
      {items.length > 0 ? (
        <div className="flex flex-col divide-y divide-border-faint">
          {items.map((item) => (
            <TaskRow
              key={item.id}
              item={item}
              answerKeyUnlocked={answerKeyUnlocked}
              isEditable={isEditable}
              response={responsesByItemId.get(item.id) ?? ""}
            />
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
  answerKeyUnlocked,
  isEditable,
  responsesByItemId,
}: {
  title: string;
  note: string;
  sections: Section[];
  itemsBySection: Map<string, Item[] | undefined>;
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
        <SectionBlock
          key={section.id}
          section={section}
          items={itemsBySection.get(section.id) ?? []}
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
  answerKeyUnlocked,
  isEditable,
  responsesByItemId,
}: {
  cambridgeSections: Section[];
  supplementSections: Section[];
  itemsBySection: Map<string, Item[] | undefined>;
  answerKeyUnlocked: boolean;
  isEditable: boolean;
  responsesByItemId: Map<string, string>;
}) {
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
        answerKeyUnlocked={answerKeyUnlocked}
        isEditable={isEditable}
        responsesByItemId={responsesByItemId}
      />
      <SectionGroup
        title="Your centre's supplement"
        note="Written by your centre, not by Cambridge -- covers teaching online and using L1, which the 2018 task predates."
        sections={supplementSections}
        itemsBySection={itemsBySection}
        answerKeyUnlocked={answerKeyUnlocked}
        isEditable={isEditable}
        responsesByItemId={responsesByItemId}
      />
    </div>
  );
}
