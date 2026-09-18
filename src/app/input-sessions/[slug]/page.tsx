import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { loadInputSessionComponent } from "@/app/input-sessions/registry";
import { InputSessionAudienceProvider } from "@/components/input-sessions/audience";

export default async function InputSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");

  const { slug } = await params;
  const { back } = await searchParams;
  const Session = await loadInputSessionComponent(slug);
  if (!Session) notFound();

  // `back` only ever comes from a link we generate ourselves (e.g. the
  // Resource Hub's input-sessions card) -- validated as a same-origin path
  // so it can never be used to redirect a candidate off-site.
  // The trainer notes at the foot of every session are the answer key and
  // the script. Staff only -- a candidate opening the same page from their
  // Resource Hub does not see the pill at all.
  const staff =
    session.profile.role === "trainer" || session.profile.role === "admin" || session.profile.role === "platform_owner";

  const backHref = back && back.startsWith("/") && !back.startsWith("//") ? back : "/input-sessions";
  const backLabel =
    backHref === "/input-sessions"
      ? "Input sessions"
      : // The Course Story sends people here too, and this page sits outside
        // every shell, so it is the one card destination with no demo pill to
        // return by (found 18 Sep 2026 by checking all 24).
        backHref === "/demo/story"
        ? "The course, day by day"
        : "Resource hub";

  return (
    <div className="input-session p-6 sm:p-10">
      {/* The pill, not a bare arrow link. Ramy, 29 Aug 2026: "maybe we can
          have that pill we talked about when you go back instead of the
          arrow" -- the same BackLink used across the rest of the app, which
          this page had never picked up. */}
      <BackLink href={backHref} label={backLabel} />
      <div className="mt-5">
        <InputSessionAudienceProvider staff={staff}>
          <Session />
        </InputSessionAudienceProvider>
      </div>
    </div>
  );
}
