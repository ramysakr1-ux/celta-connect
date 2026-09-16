import { requireRole } from "@/lib/auth/require-role";
import { CreateCentreForm } from "@/app/platform/platform-forms";

// Centre side A10, 16 Sep 2026: "Create a centre" used to be a card on
// /platform, the second home the platform owner had. It is a Command Center
// room now -- reached from the Create menu in the header and from the
// Centres card's own "+ Add a centre", which until today pointed back at
// /platform.
export default async function CreateCentrePage() {
  await requireRole("platform_owner");
  return (
    <div className="flex max-w-[620px] flex-col gap-[22px]">
      <div>
        <h1 className="font-serif text-h1 leading-[1.15] font-semibold text-ink">Create a centre</h1>
        <p className="mt-1 max-w-[68ch] text-body leading-relaxed text-muted">
          Sets up the centre and a one-time join link for its first centre owner &mdash; they create their own account
          and password through it, same as any other centre-admin invite.
        </p>
      </div>
      <div className="card p-5">
        <CreateCentreForm />
      </div>
    </div>
  );
}
