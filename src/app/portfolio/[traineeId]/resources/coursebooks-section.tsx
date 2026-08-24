"use client";

import { useActionState } from "react";
import { updateCoursebookAccessNotes, type FormState } from "@/app/portfolio/[traineeId]/resources/actions";

const initialState: FormState = { error: null };

// specs/build-spec.md "Coursebooks" -- deliberately lighter than the TP
// Points Library it's easy to confuse it with: just which book the course
// uses and how to get it, never the staged point-by-point content.
export function CoursebooksSection({
  coursebooks,
  isEditableStaff,
}: {
  coursebooks: { id: string; title: string; level: string; access_notes: string | null }[];
  isEditableStaff: boolean;
}) {
  if (coursebooks.length === 0) return null;

  return (
    <div>
      <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-muted uppercase">Coursebooks</h3>
      <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {coursebooks.map((book) => (
          <CoursebookCard key={book.id} book={book} isEditableStaff={isEditableStaff} />
        ))}
      </ul>
    </div>
  );
}

function CoursebookCard({
  book,
  isEditableStaff,
}: {
  book: { id: string; title: string; level: string; access_notes: string | null };
  isEditableStaff: boolean;
}) {
  const [state, action, pending] = useActionState(updateCoursebookAccessNotes, initialState);

  return (
    <li className="sheet flex flex-col gap-2 p-4">
      <p className="text-sm font-semibold text-ink">{book.title}</p>
      <p className="text-xs text-muted">{book.level}</p>
      {isEditableStaff ? (
        <form action={action} className="mt-1 flex flex-col gap-1.5">
          <input type="hidden" name="coursebook_id" value={book.id} />
          <textarea
            name="access_notes"
            rows={2}
            defaultValue={book.access_notes ?? ""}
            placeholder="How candidates access this book (e.g. provided in the welcome pack, a Drive link)"
            className="rounded-[6px] border border-input bg-card-inset px-2 py-1.5 text-xs text-ink outline-none focus:border-primary"
          />
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-[6px] border border-border px-2 py-1 text-xs text-ink trainee-hover-fill disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : book.access_notes ? (
        <p className="mt-1 whitespace-pre-line text-xs text-ink">{book.access_notes}</p>
      ) : null}
    </li>
  );
}
