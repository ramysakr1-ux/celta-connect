import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { loadInputSessionComponent } from "@/app/input-sessions/registry";

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
  const backHref = back && back.startsWith("/") && !back.startsWith("//") ? back : "/input-sessions";
  const backLabel = backHref === "/input-sessions" ? "← Input sessions" : "← Resource hub";

  return (
    <div className="p-6 sm:p-10">
      <Link href={backHref} className="text-sm text-primary hover:underline">
        {backLabel}
      </Link>
      <div className="mt-5">
        <Session />
      </div>
    </div>
  );
}
