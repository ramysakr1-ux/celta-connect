"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Ramy, 2026-08-24: "take the name Amara... put that big font on top of
// Connect the logo. And then Connect the logo will come down... I want
// this to go on top." Landing-page-only (confirmed explicitly) -- the
// Connect header bar is shared across every trainee page, so this can't
// live inside it; instead it's its own banner, self-gating on pathname so
// it renders only on the bare /portfolio/:traineeId route and nowhere
// else.
//
// Ramy, 2026-08-24 (revised): dropped the weekday and the "of M" -- the
// exact date already sits right below in the page's own heading (Today's
// "Monday 24 August"), so this only needs "week N". Added a
// good morning/afternoon/evening greeting ahead of the name, made the
// heading bigger, and gave it more breathing room before the Connect bar
// beneath it ("push Connect down a little").
function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function TraineeNameBanner({
  traineeId,
  traineeName,
  weekNumber,
}: {
  traineeId: string;
  traineeName: string;
  weekNumber: number | null;
}) {
  const pathname = usePathname();

  // Was `greetingForHour(new Date().getHours())` computed during render, in
  // a client component -- which renders on the server too. The server reads
  // its own clock (UTC on Vercel) and the browser reads the reader's, so the
  // two produce different words and React reports a hydration mismatch.
  // That was React #418, the only console error left in the app, on every
  // page of the trainee workspace. Found 31 Aug 2026 in the pre-demo sweep;
  // my first attempt blamed a date format on the TP page, which was a real
  // bug but not this one.
  //
  // The volunteer's own Greeting already had the answer (student/[token]/
  // greeting.tsx): start with a neutral word and swap in the real greeting
  // on mount, once the client's clock is actually available. Same pattern
  // here rather than a second invention.
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    // Runs once after mount purely to read the client's own clock -- not
    // external state being synchronized, which is what the lint rule is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  // After the hooks, never before: this component returns null on every
  // route but the workspace landing, and an early return above a hook would
  // change the hook order between renders.
  if (pathname !== `/portfolio/${traineeId}`) return null;

  return (
    <div className="container pt-6 pb-7">
      <h1 className="font-serif text-ink" style={{ fontSize: "36px", lineHeight: 1.15 }}>
        {greeting}, {traineeName}
        {weekNumber ? <span className="text-muted"> — week {weekNumber}</span> : null}
      </h1>
    </div>
  );
}
