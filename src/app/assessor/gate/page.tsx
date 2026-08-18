import { redirect } from "next/navigation";
import { getAssessorTermsStatus } from "@/lib/auth/portfolio-access";
import { AssessorTermsForm } from "@/app/assessor/gate/terms-form";

// specs/ASSESSOR-GATE-TERMS.md, "no account -- the terms are the screen":
// there's no account to create, so accepting these is the only place terms
// can be presented to someone who never signs up.
export default async function AssessorGatePage() {
  const status = await getAssessorTermsStatus();
  if (!status) redirect("/login?error=assessor_link_invalid");
  if (status.accepted) redirect("/assessor");

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Cambridge assessor · read-only access</p>
        <h1 className="font-serif text-2xl text-ink">Before you open the pack</h1>
      </div>
      <div className="sheet">
        <AssessorTermsForm />
      </div>
      <p className="text-xs text-muted">
        Acceptance is remembered against this link, so a second visit goes straight in. A newly issued link asks again.
      </p>
    </div>
  );
}
