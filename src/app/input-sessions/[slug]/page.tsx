import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { loadInputSessionComponent } from "@/app/input-sessions/registry";

export default async function InputSessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");

  const { slug } = await params;
  const Session = await loadInputSessionComponent(slug);
  if (!Session) notFound();

  return (
    <div className="p-6 sm:p-10">
      <Link href="/input-sessions" className="text-sm text-primary hover:underline">
        ← Input sessions
      </Link>
      <div className="mt-5">
        <Session />
      </div>
    </div>
  );
}
