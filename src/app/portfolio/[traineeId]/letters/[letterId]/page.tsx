import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { AcknowledgeButton } from "@/app/portfolio/[traineeId]/letters/[letterId]/acknowledge-button";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

const LETTER_TITLE: Record<string, string> = {
  fail_risk: "Notice of a potential Fail outcome",
  assignment_warning: "Notice following a failed assignment",
  deferral: "Deferral — centre record and candidate letter",
};

// Candidate-facing view of a formal letter -- RLS already scopes reads to
// the trainee's own rows, so this is "render what the scoped client
// returns", same pattern as every other candidate detail page.
export default async function FormalLetterPage({ params }: { params: Promise<{ traineeId: string; letterId: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId, letterId } = await params;
  const supabase = await createClient();

  const { data: letter } = await supabase.from("formal_letters").select("*").eq("id", letterId).maybeSingle();
  if (!letter) notFound();

  const snapshot = letter.snapshot as unknown as FormalLetterInput;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/portfolio/${traineeId}`} className="text-xs text-muted hover:text-primary">
        ← Course stream
      </Link>

      <div className="sheet flex flex-col gap-3">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{snapshot.kicker ?? "Formal letter"}</p>
        <h1 className="font-serif text-xl text-ink">{LETTER_TITLE[letter.letter_type] ?? snapshot.docTitle}</h1>
        <p className="text-sm text-muted">Issued {new Date(letter.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>

        <div className="flex flex-col gap-3 border-t border-border-faint pt-3">
          {snapshot.body.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink">
              {para}
            </p>
          ))}
          {snapshot.list && snapshot.list.items.length > 0 ? (
            <div className="rounded-[6px] bg-surface-muted/40 p-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{snapshot.list.title}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {snapshot.list.items.map((item, i) => (
                  <li key={i} className="text-sm text-ink">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {snapshot.closing ? <p className="text-sm leading-relaxed text-ink">{snapshot.closing}</p> : null}
        </div>

        <a href={`/api/formal-letter/${letterId}`} className="self-start text-sm font-medium text-primary hover:underline">
          Download PDF →
        </a>

        <div className="border-t border-border-faint pt-3">
          {letter.acknowledged_at ? (
            <p className="text-sm font-semibold text-primary">
              Acknowledged {new Date(letter.acknowledged_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          ) : (
            <AcknowledgeButton letterId={letterId} />
          )}
        </div>
      </div>
    </div>
  );
}
