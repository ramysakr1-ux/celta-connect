import { formatCalendarDate } from "@/lib/format-date";
import { ordinal } from "@/lib/stage2-tutorials";

// Course Stream's hero state machine.
//
// Trainee spec C4: today-tab.tsx was 54KB in one server component, and this
// eight-state ladder plus the Catch-up builder (waiting-list.ts beside it)
// were the two pieces most likely to grow again. Lifted out whole -- the
// states, the copy and the reasons behind the copy are unchanged.

/** A TP this candidate teaches on some day: today, tomorrow, or further out. */
export interface TeachingOn {
  date: string;
  tpNumber: number;
  title: string;
  teachingOrder: number;
  groupSize: number;
  /** The timetable row itself -- Course Stream's day track needs to know
   *  which block on the day is this trainee's own, to give it the gold. */
  eventId: string;
  zoomUrl: string | null;
  eventTime: string | null;
  groupName: string | null;
  joinable: boolean;
  level: string | null;
  volunteers: { expected: number; total: number } | null;
}

export type HeroKind =
  | "teaching"
  | "teaching_tomorrow"
  | "teaching_next"
  | "teaching_unrecorded"
  | "teaching_done"
  | "teaching_unscheduled"
  | "course_finished"
  | "precourse_gtky";

export interface HeroContent {
  label: string;
  big: string;
  bigSub: string;
  ctaHref: string;
  ctaLabel: string;
}

const TP_LESSON_LENGTH_MINUTES = 45;

// "1 of 2 coming" once somebody has replied; "nobody has replied yet" when
// nobody has. Silence is not a yes, and a bare "0 of 2 coming" would read
// as a refusal rather than as no answer.
export function volunteerLine(v: { expected: number; total: number }): string {
  const noun = v.total === 1 ? "volunteer" : "volunteers";
  if (v.expected === 0) return `${v.total} ${noun} · nobody has replied yet`;
  return `${v.expected} of ${v.total} ${noun} coming`;
}

export function buildHeroState({
  traineeId,
  preCourse,
  postCourse,
  teachingToday,
  teachingTomorrow,
  teachingNext,
  unrecordedLabel,
  unrecordedTps,
  hasTeachingSchedule,
  gtkyAssignment,
}: {
  traineeId: string;
  preCourse: boolean;
  postCourse: boolean;
  teachingToday: TeachingOn | null;
  teachingTomorrow: TeachingOn | null;
  teachingNext: TeachingOn | null;
  unrecordedLabel: string | null;
  unrecordedTps: unknown[];
  /** The candidate is in a subgroup with a half order -- so "all taught" can
   *  mean it, rather than meaning the lookup came back empty. */
  hasTeachingSchedule: boolean;
  gtkyAssignment: { chosen_slug: string | null } | null;
}): { kind: HeroKind; generic: HeroContent | null } {
  const heroKind: HeroKind = postCourse
    ? "course_finished"
    : preCourse
    ? "precourse_gtky"
    : teachingToday
      ? "teaching"
      : teachingTomorrow
        ? "teaching_tomorrow"
        : teachingNext
          ? "teaching_next"
          : unrecordedLabel
            ? "teaching_unrecorded"
            : hasTeachingSchedule
              ? "teaching_done"
              : "teaching_unscheduled";
  const generic: HeroContent | null =
    heroKind === "course_finished"
      ? {
          label: "Course complete",
          big: "That's your course finished",
          // Deliberately says nothing about the outcome. A trainee never sees
          // their grade in Connect -- it is Cambridge's to give, after the
          // assessor and the awarding process -- so a landing that implied one
          // either way would be inventing news. What it CAN do is point at the
          // record they own and tell them where the result actually comes from.
          bigSub: "Your record stays here. Your result comes from Cambridge through your centre.",
          ctaHref: `/portfolio/${traineeId}/celta5`,
          ctaLabel: "Your record",
        }
      : heroKind === "precourse_gtky"
      ? !gtkyAssignment
        ? {
            label: "Before day one",
            big: "Your day-one activity",
            bigSub: "Ready once your teaching groups are set -- check back closer to the start.",
            ctaHref: `/portfolio/${traineeId}/pre-course-task`,
            ctaLabel: "Pre-course task",
          }
        : !gtkyAssignment.chosen_slug
          ? {
              label: "Before day one",
              big: "Pick your day-one activity",
              bigSub: "Three options, unassessed -- pick one before your first morning.",
              ctaHref: `/portfolio/${traineeId}/gtky`,
              ctaLabel: "Choose your activity",
            }
          : {
              label: "Before day one",
              big: "You're set for day one",
              bigSub: "Your day-one activity is picked -- see you Monday.",
              ctaHref: `/portfolio/${traineeId}/gtky`,
              ctaLabel: "View your pick",
            }
      : heroKind === "teaching_tomorrow" && teachingTomorrow
        ? {
            label: "You teach tomorrow",
            big: `TP${teachingTomorrow.tpNumber} — ${teachingTomorrow.title}`,
            bigSub: [
              teachingTomorrow.eventTime ? teachingTomorrow.eventTime.slice(0, 5) : null,
              teachingTomorrow.level,
              `${ordinal(teachingTomorrow.teachingOrder)} of ${teachingTomorrow.groupSize} tomorrow`,
              `${TP_LESSON_LENGTH_MINUTES} min`,
              teachingTomorrow.groupName ? `Group ${teachingTomorrow.groupName}` : null,
              teachingTomorrow.volunteers ? volunteerLine(teachingTomorrow.volunteers) : null,
            ]
              .filter(Boolean)
              .join(" · "),
            ctaHref: `/portfolio/${traineeId}/tp/${teachingTomorrow.tpNumber}`,
            ctaLabel: "Open your plan",
          }
        : heroKind === "teaching_next" && teachingNext
          ? {
              // Same "You teach {day}" pattern as today/tomorrow, just with
              // the actual weekday name once it's further out than tomorrow.
              label: `You teach ${formatCalendarDate(teachingNext.date, { weekday: "long" })}`,
              big: `TP${teachingNext.tpNumber} — ${teachingNext.title}`,
              bigSub: [
                formatCalendarDate(teachingNext.date, { day: "numeric", month: "long" }),
                teachingNext.eventTime ? teachingNext.eventTime.slice(0, 5) : null,
                teachingNext.level,
                `${ordinal(teachingNext.teachingOrder)} of ${teachingNext.groupSize}`,
                `${TP_LESSON_LENGTH_MINUTES} min`,
                teachingNext.groupName ? `Group ${teachingNext.groupName}` : null,
                teachingNext.volunteers ? volunteerLine(teachingNext.volunteers) : null,
              ]
                .filter(Boolean)
                .join(" · "),
              // Ramy, 28 Aug 2026: "when they click on my plan, it will open
              // the plan for the coming TP" -- same direct link as today
              // and tomorrow, not a detour through the timetable page.
              ctaHref: `/portfolio/${traineeId}/tp/${teachingNext.tpNumber}`,
              ctaLabel: "Open your plan",
            }
          : heroKind === "teaching_unrecorded" && unrecordedLabel
            ? {
                label: "Teaching practice",
                big: `${unrecordedLabel} ${unrecordedTps.length === 1 ? "isn't" : "aren't"} recorded yet`,
                // Deliberately not "nothing for you to do": most of the time
                // the tutor simply hasn't written it up, but a deferred or
                // missed lesson looks identical from here, and this screen
                // cannot tell the two apart. So it says who writes it and what
                // to do if it stays open, and claims nothing else.
                bigSub: "Your tutor logs the outcome after the lesson -- ask them if it stays open.",
                ctaHref: `/portfolio/${traineeId}/tp`,
                ctaLabel: "My teaching",
              }
          : heroKind === "teaching_done"
            ? {
                label: "Teaching practice",
                big: "All your TPs are taught",
                bigSub: "Nothing left to teach -- see My teaching for the full record.",
                ctaHref: `/portfolio/${traineeId}/tp`,
                ctaLabel: "My teaching",
              }
            : heroKind === "teaching_unscheduled"
              ? {
                  label: "Teaching practice",
                  big: "Your teaching schedule isn't set up yet",
                  bigSub: "Nothing to show here until your tutor puts you in a TP group.",
                  ctaHref: `/portfolio/${traineeId}/tp`,
                  ctaLabel: "My teaching",
                }
              : null;
  return { kind: heroKind, generic };
}
