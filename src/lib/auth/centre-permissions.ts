// The Centre Admin role family's permissions, in one place.
//
// Source of truth: `for-claude-code-centre-admin-full.md` and the ROLES array
// in `Centre Admin.dc.html`. The matrix below is that spec's own permission
// lists transcribed, not a paraphrase -- each role's comment quotes it.
//
// Why one module rather than checks scattered through screens: the spec's
// read-only role is defined *structurally*, not by enforcement --
//
//   "The absence of an edit button everywhere is the whole design. A read-only
//    role that hides its restrictions behind error messages is worse than no
//    role at all -- the buttons simply are not there."
//
// So components ask what the viewer can do and omit controls accordingly. That
// only stays true if every screen asks the same question of the same answer;
// the tp_lessons bug is what happens when the same question gets answered in
// four places.

export const CENTRE_ROLES = [
  "centre_administrator",
  "centre_manager",
  "course_administrator",
  "centre_owner",
] as const;
export type CentreRole = (typeof CENTRE_ROLES)[number];

export const CENTRE_ROLE_LABELS: Record<CentreRole, string> = {
  centre_administrator: "Centre administrator",
  centre_manager: "Centre manager",
  course_administrator: "Course administrator",
  centre_owner: "Centre owner",
};

/**
 * Capabilities are split deliberately into centre-level and
 * course-administration-level, because the Centre owner's rules differ across
 * that line (see CENTRE_OWNER note below).
 */
export type Capability =
  // -- Centre level
  | "course.create"
  | "course.editRecord"
  | "course.restoreDeleted"
  | "course.reassignUnowned"
  | "roles.grant"
  | "centre.settings.edit"
  | "payments.view"
  | "payments.edit"
  | "admissions.view"
  | "admissions.manage"
  | "volunteers.view"
  | "volunteers.manage"
  | "enrolment.view"
  | "import.run"
  | "assessorPack.export"
  // -- Course administration (the Course Admin spec's own screens)
  | "courseAdmin.view"
  | "courseAdmin.invite"
  | "courseAdmin.groups"
  | "courseAdmin.settings"
  | "timetable.publish";

/**
 * Capabilities NO role in this family ever has, at any centre. Kept as a list
 * rather than simply omitted so the boundary is visible and greppable.
 *
 * "Course chat is closed to every admin role, including the owner. Tutors
 *  write candidly in a course channel because they know exactly who reads it;
 *  one admin exception ends that permanently."
 *
 * Grading, lesson feedback and CELTA 5 records are equally out of reach: they
 * need a trainer-to-trainer grant, "never self-service" -- which is also why a
 * Centre owner cannot reach into a course without an invite from its MCT.
 */
export const NEVER_FOR_ADMIN_ROLES = ["courseChat", "grading", "candidateWork"] as const;

/**
 * true  = may do it
 * "read" = may see it but not change it (the spec's R state)
 * false = absent from the UI entirely
 */
type Grant = true | "read" | false;

const MATRIX: Record<CentreRole, Partial<Record<Capability, Grant>>> = {
  // "Create and edit courses / Invite tutors, candidates, volunteers / See and
  //  edit fees, deposits, payments / Form groups and publish timetables /
  //  Export the assessor pack." Cannot: course chat, grade or mark, see lesson
  //  feedback or CELTA 5 records.
  centre_administrator: {
    "course.create": true,
    "course.editRecord": true,
    "centre.settings.edit": true,
    "payments.view": true,
    "payments.edit": true,
    "admissions.view": true,
    "admissions.manage": true,
    "volunteers.view": true,
    "volunteers.manage": true,
    "enrolment.view": true,
    "import.run": true,
    "assessorPack.export": true,
    "courseAdmin.view": true,
    "courseAdmin.invite": true,
    "courseAdmin.groups": true,
    "courseAdmin.settings": true,
    "timetable.publish": true,
  },

  // "Read-only across the whole centre... Every course and its state / The
  //  admissions pipeline / Fees, deposits and outstanding balances / Enrolment
  //  and completion figures." Cannot: edit anything at all, invite or remove
  //  people, course chat, candidate work/feedback/grades.
  centre_manager: {
    "course.editRecord": "read",
    "payments.view": "read",
    "admissions.view": "read",
    "volunteers.view": "read",
    "enrolment.view": "read",
    "courseAdmin.view": "read",
    // Everything else is absent, including import.run -- an import creates
    // people, which is squarely "edit anything at all".
  },

  // "Everything a centre administrator can do, scoped to named courses...
  //  Other courses, in outline only." Cannot: create a new course, change
  //  centre settings, course chat, grade or mark.
  //
  // IMPORTANT: every `true` here is additionally scoped to the courses this
  // person is granted -- use canOnCourse(), not can(), for anything
  // course-specific.
  //
  // Course administrator is Cambridge-approval-gated, but MUST NOT be gated on
  // being a tutor on the course. Ramy, 2026-08-16: "Course admin is often the
  // main course tutor, but sometimes also a Cambridge-approved trainer who is
  // not on the course. Someone who works at the centre would set up the course
  // and invite the MCT and the ACT. But it could be the same person as well."
  //
  // An earlier version of this comment said the gate was "enforced by
  // requiring a course_tutors row alongside the scope row". That was never
  // implemented -- which is the only reason it did no harm -- and it would
  // have locked out exactly the person described above: the approved trainer
  // who sets a course up and never teaches on it.
  //
  // So the approval lives on the person, not on their presence in the cohort.
  course_administrator: {
    "course.editRecord": true,
    "payments.view": true,
    "payments.edit": true,
    "admissions.view": true,
    "admissions.manage": true,
    "volunteers.view": true,
    "volunteers.manage": true,
    "enrolment.view": true,
    "courseAdmin.view": true,
    "courseAdmin.invite": true,
    "courseAdmin.groups": true,
    "courseAdmin.settings": true,
    "timetable.publish": true,
    "course.create": false,
    "centre.settings.edit": false,
  },

  // The spec says "everything a centre administrator can do", plus restore a
  // deleted course within 30 days, reassign an unowned course, and appoint or
  // remove administrators.
  //
  // DELIBERATE DIVERGENCE, on Ramy's instruction (2026-08-16): the owner is
  // **read-only on course administration**. His words -- "the centre owner is
  // read only for the course admin, but not for the rest... the rest, the
  // centre owner can intervene, can change things, but it leaves a digital
  // footprint." That is narrower than the written spec and it wins, because it
  // follows from the Cambridge gate: an owner who is not an approved tutor
  // must not be able to act on a course. He was equally clear the owner has no
  // access to the course *itself* without an invite from the course MCT, which
  // is why nothing here grants candidate work.
  //
  // Interventions that are permitted are logged -- see centre_owner_actions
  // (migration 0103).
  centre_owner: {
    // Custodial powers over a course's EXISTENCE and ownership -- explicitly
    // the owner's in the spec, and distinct from running one. These are what
    // the role exists for: somebody left, somebody is off sick.
    "course.restoreDeleted": true,
    "course.reassignUnowned": true,
    "roles.grant": true,
    // Centre level: may intervene, and every one of these is logged.
    "centre.settings.edit": true,
    "payments.view": true,
    "payments.edit": true,
    "admissions.view": true,
    "admissions.manage": true,
    "volunteers.view": true,
    "volunteers.manage": true,
    "enrolment.view": true,
    "import.run": true,
    // Everything a centre administrator can do. Ramy, 2026-08-16, asked
    // directly and answering the conflict between this matrix and
    // Centre Admin.dc.html: "The centre owner can do everything the centre
    // admin can do. Yes, that's correct. But cannot do everything the course
    // admin can do. There's a difference."
    //
    // This SUPERSEDES an earlier instruction the same day that made these
    // read-only. The line he is drawing is not centre-admin powers versus
    // owner powers -- it is that holding this role never makes someone a
    // course administrator on a particular course. Course administration is
    // scoped to named courses and comes with a Cambridge-approval gate; the
    // owner acts centre-wide and does not inherit that scope by being owner.
    "course.create": true,
    "course.editRecord": true,
    "assessorPack.export": true,
    "courseAdmin.view": true,
    "courseAdmin.invite": true,
    "courseAdmin.groups": true,
    "courseAdmin.settings": true,
    "timetable.publish": true,
  },
};

/**
 * Every action logged as an owner intervention, for centre_owner_actions.
 *
 * "Obviously, everything would leave a digital footprint" (Ramy, 2026-08-16).
 * That sentence is what makes the owner role safe to widen: the role exists
 * for the day somebody leaves without handing over, and an unlogged power that
 * broad would be indistinguishable from interfering with a colleague's course.
 *
 * So this list tracks the grant list exactly -- the five course-administration
 * capabilities below were added the moment the owner gained them, rather than
 * left behind as a silent gap.
 */
export const LOGGED_FOR_OWNER: Capability[] = [
  "course.create",
  "course.editRecord",
  "course.restoreDeleted",
  "course.reassignUnowned",
  "roles.grant",
  "centre.settings.edit",
  "payments.edit",
  "admissions.manage",
  "volunteers.manage",
  "import.run",
  "assessorPack.export",
  "courseAdmin.invite",
  "courseAdmin.groups",
  "courseAdmin.settings",
  "timetable.publish",
];

/**
 * Roles combine by union -- the spec's second account shape, "a single account
 * can hold Centre manager + Centre administrator + Course administrator at
 * once; permissions simply union together, no in-app switcher."
 *
 * A `true` from any role beats a "read" from another, which is what makes the
 * union safe: holding the read-only role alongside a working one never
 * downgrades you.
 */
export function grantFor(roles: CentreRole[], capability: Capability): Grant {
  let best: Grant = false;
  for (const role of roles) {
    const g = MATRIX[role]?.[capability];
    if (g === true) return true;
    if (g === "read") best = "read";
  }
  return best;
}

/** Can act. Use for rendering a control at all. */
export function can(roles: CentreRole[], capability: Capability): boolean {
  return grantFor(roles, capability) === true;
}

/** Can see, whether or not they can act. Use for rendering the data. */
export function canView(roles: CentreRole[], capability: Capability): boolean {
  return grantFor(roles, capability) !== false;
}

/**
 * Course-specific check. A Course administrator's powers apply only to the
 * courses they hold; the spec's "other courses, in outline only" is the read
 * fallback. Every other role in the family is centre-wide, so their answer
 * doesn't depend on which course.
 */
export function canOnCourse(
  roles: CentreRole[],
  capability: Capability,
  courseId: string,
  scopedCourseIds: string[]
): boolean {
  const others = roles.filter((r) => r !== "course_administrator");
  if (can(others, capability)) return true;
  if (!roles.includes("course_administrator")) return false;
  if (!scopedCourseIds.includes(courseId)) return false;
  return can(["course_administrator"], capability);
}

/**
 * Which landing a person should get. The two specs are emphatic that Centre
 * Admin and Course Admin are separate places -- "never merge these two builds"
 * -- and one flat `admin` landing on a course-shaped screen is the bug this
 * whole model exists to fix.
 */
export function landingFor(roles: CentreRole[]): "centre-admin" | "course-admin" | null {
  if (roles.some((r) => r === "centre_administrator" || r === "centre_manager" || r === "centre_owner")) {
    return "centre-admin";
  }
  if (roles.includes("course_administrator")) return "course-admin";
  return null;
}
