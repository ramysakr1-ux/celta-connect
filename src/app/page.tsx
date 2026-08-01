import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="font-serif text-2xl text-ink">Celta Connect</h1>
        <p className="mt-2 text-muted">Course administration, built for centers.</p>
        <div className="mt-6 flex justify-center gap-2">
          <span className="status-pill status-pill-on-track">On Track</span>
          <span className="status-pill status-pill-at-risk">At Risk</span>
          <span className="status-pill status-pill-pending">Not Yet Assessed</span>
          <span className="badge-pass-a">Pass A</span>
        </div>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-[6px] bg-primary px-4 py-2 font-medium text-card"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
