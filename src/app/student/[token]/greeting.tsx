"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Ramy, 23 Aug 2026: "should say the trainee's name -- good morning, good
// evening, good afternoon, and then the name of the volunteer student."
// Computed client-side, after mount, rather than from the server's own
// clock -- this page is server-rendered and a volunteer's local time zone
// has no relationship to wherever the server happens to run, so a
// server-computed greeting could easily say "good evening" to someone
// opening this at breakfast. Starts as a neutral "Hello" during SSR/first
// paint (same reason initial-render randomization is avoided elsewhere in
// this app -- picking a real greeting before the client's own Date is
// available would just be guessing) and swaps in the real one on mount.
export function Greeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    // Deliberate: this only ever needs to run once, after mount, to read
    // the client's own clock -- not "external system state that changes,"
    // which is what the lint rule expects a setState-in-effect to be
    // synchronizing with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);
  return (
    <p className="text-sm font-medium text-ink">
      {greeting}, {name}
    </p>
  );
}
