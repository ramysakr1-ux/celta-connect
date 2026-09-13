"use client";

import { createContext, useContext } from "react";

// Who is reading an input session.
//
// Every session ends with a "Show trainer notes" pill, and the notes behind
// it are the trainer's script: the answer keys, which item is the trap,
// what the room usually gets wrong, and what to say when it does. The
// component's own comment always said "clearly marked trainer only so it's
// obvious this isn't candidate content if someone screen-shares mid-reveal"
// -- written for a page on the trainer's screen.
//
// But the Resource Hub hands the same page to candidates, and it has done
// since the library was built: walking the trainee side on 13 Sep 2026,
// Amara could open Rapport and teacher talk, press the pill, and read the
// whole script, predicted answers included.
//
// So the page says who is reading, and TrainerNotes disappears for anyone
// who is not staff. Defaults to false: a session rendered outside the
// provider shows no notes, which is the safe direction to fail.
const InputSessionAudience = createContext<{ staff: boolean }>({ staff: false });

export function InputSessionAudienceProvider({ staff, children }: { staff: boolean; children: React.ReactNode }) {
  return <InputSessionAudience.Provider value={{ staff }}>{children}</InputSessionAudience.Provider>;
}

export function useIsStaffReader(): boolean {
  return useContext(InputSessionAudience).staff;
}
