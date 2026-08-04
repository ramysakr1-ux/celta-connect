import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="sheet w-full max-w-md p-8 text-center">
        <Wordmark size="lg" />
        <p className="mt-2 text-sm text-muted">Course administration, built for centers.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <span className="pill pill-success">On Track</span>
          <span className="pill pill-danger">At Risk</span>
          <span className="pill pill-neutral">Not Yet Assessed</span>
          <span className="pill pill-info">Pass A</span>
        </div>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
