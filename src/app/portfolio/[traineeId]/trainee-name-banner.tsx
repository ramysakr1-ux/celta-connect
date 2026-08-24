"use client";

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
  if (pathname !== `/portfolio/${traineeId}`) return null;

  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="container pt-6 pb-7">
      <h1 className="font-serif text-ink" style={{ fontSize: "36px", lineHeight: 1.15 }}>
        {greeting}, {traineeName}
        {weekNumber ? <span className="text-muted"> — week {weekNumber}</span> : null}
      </h1>
    </div>
  );
}
