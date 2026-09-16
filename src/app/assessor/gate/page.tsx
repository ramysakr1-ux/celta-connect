import { redirect } from "next/navigation";
import { getAssessorTermsStatus } from "@/lib/auth/portfolio-access";
import { AssessorTermsForm } from "@/app/assessor/gate/terms-form";
import { AssessorHead } from "@/components/assessor/assessor-head";

// specs/ASSESSOR-GATE-TERMS.md, "no account -- the terms are the screen":
// there's no account to create, so accepting these is the only place terms
// can be presented to someone who never signs up.
export default async function AssessorGatePage() {
  const status = await getAssessorTermsStatus();
  if (!status) redirect("/login?error=assessor_link_invalid");
  if (status.accepted) redirect("/assessor");

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      {/* The same head as the pack and its five sub-pages (spec A1) -- this
          screen used Tailwind's own font-serif, which was a third font for
          one role. */}
      <AssessorHead eyebrow="Cambridge assessor · read-only access" title="Before you open the pack" />
      <div className="sheet">
        <AssessorTermsForm />
      </div>
      <p className="text-label text-muted">
        Acceptance is remembered against this link, so a second visit goes straight in. A newly issued link asks again.
      </p>
    </div>
  );
}
