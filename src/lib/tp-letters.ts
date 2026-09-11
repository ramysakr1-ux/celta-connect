// Traditional CELTA lettering, replacing our word "Half".
//
// Ramy, 11 Sep 2026: "there is no half. There is an A-day and a B-day. Three
// trainees teach on one day, we call them A B C; the other three teach on the
// other day, D E F. We can give it different names, but traditionally we use
// letters." The Administration Handbook agrees -- a TP group of four to six
// candidates (§7.1) teaches across two days because a class can only do three
// hours of TP a day and a candidate teaches once a day (§26). Those two
// teaching-day sets are what we had been mislabelling "Half A / Half B".
//
// Letters are per group, not across the course: every TP group has six
// candidates lettered A-F (a group is four to six, §7.1). Ramy, 11 Sep 2026:
// "there is no G-L. There are only six in the group -- Day A is A, B, C, Day B
// is D, E, F." Two groups each have their own A-F; a tutor only ever sees their
// own group's six, so the letters never collide in view.

const ALPHABET = "ABCDEF";

export interface LetterMember {
  traineeId: string;
  baseSlot: number;
}
export interface LetterHalf {
  halfOrder: 1 | 2;
  members: LetterMember[];
}

/** Every trainee in one TP group mapped to their letter, A-F. Day A is
 *  lettered first, by slot, then Day B -- so a 3+3 group reads A B C / D E F
 *  and an uneven 4+2 reads A B C D / E F. */
export function lettersForGroup(halves: LetterHalf[]): Map<string, string> {
  const ordered = [...halves].sort((a, b) => a.halfOrder - b.halfOrder);
  const out = new Map<string, string>();
  let n = 0;
  for (const half of ordered) {
    for (const m of [...half.members].sort((a, b) => a.baseSlot - b.baseSlot)) {
      out.set(m.traineeId, ALPHABET[n] ?? "?");
      n += 1;
    }
  }
  return out;
}

/** The group's two teaching days: "Day A" (half_order 1), "Day B" (half_order 2). */
export function dayLabel(halfOrder: 1 | 2): string {
  return halfOrder === 1 ? "Day A" : "Day B";
}

/** The letter range a day-set covers, e.g. "A–C" or a lone "A". */
export function dayLetterRange(letters: string[]): string {
  const sorted = [...letters].filter(Boolean).sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return sorted[0];
  return `${sorted[0]}–${sorted[sorted.length - 1]}`;
}
