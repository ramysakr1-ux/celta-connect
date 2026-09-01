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

// for-claude-code-centre-role-rename-and-payments-fix.md: display labels
// only -- the underlying slugs (centre_administrator, centre_manager) are
// unchanged, since renaming them would mean an enum/DB migration touching
// every RLS policy and call site that references them, for a change the
// spec itself says is negotiable. Anywhere in this codebase you see the
// slug `centre_administrator` in code or comments, it now displays as
// "Centre manager"; `centre_manager` now displays as "Centre observer".
export const CENTRE_ROLE_LABELS: Record<CentreRole, string> = {
  centre_administrator: "Centre manager",
  centre_manager: "Centre observer",
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

// for-claude-code-centre-owner-role-customizer.md: the Centre Owner's
// override layer speaks "Full/View/None" (the customizer screen's own
// vocabulary, matching Centre Owner Landing.dc.html's cycling pills) --
// these two just translate between that and the internal Grant type
// nothing else in this file needs to change to know about.
export type GrantLevel = "full" | "view" | "none";

export function grantLevelToGrant(level: GrantLevel): Grant {
  if (level === "full") return true;
  if (level === "view") return "read";
  return false;
}

export function grantToGrantLevel(grant: Grant): GrantLevel {
  if (grant === true) return "full";
  if (grant === "read") return "view";
  return "none";
}

/**
 * A centre owner's per-centre override on top of MATRIX -- role key (built-in
 * CentreRole or a centre_custom_roles.role_key) to capability key (built-in
 * Capability or a centre_custom_capabilities.capability_key) to the level set.
 * An entry here always wins over MATRIX for that role+capability, including
 * down to "none" -- the owner can tighten a built-in role's default, not just
 * loosen it.
 *
 * Course chat, grading, lesson feedback and CELTA 5 records are structurally
 * excluded, not filtered here -- those are gated entirely by separate code
 * (tutor/trainee status, course_tutors rows) that never reads this matrix at
 * all, so there is nothing an override could grant even if someone typed a
 * custom capability with one of those names.
 */
export type OverrideMatrix = Record<string, Partial<Record<string, GrantLevel>>>;

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
    // for-claude-code-centre-role-rename-and-payments-fix.md §2: money is
    // exclusively the Centre manager's domain. Removed 2026-08-23 -- was
    // "payments.view": true, "payments.edit": true. No fallback path
    // should grant this role payments visibility; canOnCourse() is
    // currently unused anywhere in the app, so the only other place that
    // could leak this was /centre/courses/[id]'s pricing form, which
    // gated on course.editRecord instead of payments.edit -- fixed
    // alongside this.
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
  // "Restore a deleted course" is NOT here, removed 1 Sep 2026. There is no
  // soft delete anywhere in the schema -- no deleted_at column, on courses or
  // anything else -- so the capability was a toggle in the owner's role
  // builder that granted a power nothing in the app could check. A permission
  // that grants nothing is worse than an absent one: it reads as a promise.
  // Reinstating it means adding soft delete and changing what deletion means
  // everywhere it happens, which is a decision, not a rename.
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
 *
 * `roles` is `string[]`, not `CentreRole[]` -- a person can hold a centre
 * owner-defined custom role, which has no MATRIX entry at all (its baseline
 * is "none" until the owner sets overrides for it). `capability` is likewise
 * `string` so a custom capability can be checked the same way; every existing
 * call site keeps passing a literal `Capability`, which is always a valid
 * `string`, so nothing about the ~20 call sites already in the app changes.
 * `overrides`, when passed, is this role's centre's resolved
 * OverrideMatrix (from getCentreRoleContext) -- omitting it (every call site
 * from before 2026-08-23) is identical to a centre with no overrides set.
 */
export function grantFor(roles: string[], capability: string, overrides?: OverrideMatrix): Grant {
  let best: Grant = false;
  for (const role of roles) {
    const overrideLevel = overrides?.[role]?.[capability];
    const g: Grant =
      overrideLevel !== undefined ? grantLevelToGrant(overrideLevel) : (MATRIX[role as CentreRole]?.[capability as Capability] ?? false);
    if (g === true) return true;
    if (g === "read") best = "read";
  }
  return best;
}

/** Can act. Use for rendering a control at all. */
export function can(roles: string[], capability: string, overrides?: OverrideMatrix): boolean {
  return grantFor(roles, capability, overrides) === true;
}

/** Can see, whether or not they can act. Use for rendering the data. */
export function canView(roles: string[], capability: string, overrides?: OverrideMatrix): boolean {
  return grantFor(roles, capability, overrides) !== false;
}

/**
 * Course-specific check. A Course administrator's powers apply only to the
 * courses they hold; the spec's "other courses, in outline only" is the read
 * fallback. Every other role in the family is centre-wide, so their answer
 * doesn't depend on which course.
 */
export function canOnCourse(
  roles: string[],
  capability: string,
  courseId: string,
  scopedCourseIds: string[],
  overrides?: OverrideMatrix
): boolean {
  const others = roles.filter((r) => r !== "course_administrator");
  if (can(others, capability, overrides)) return true;
  if (!roles.includes("course_administrator")) return false;
  if (!scopedCourseIds.includes(courseId)) return false;
  return can(["course_administrator"], capability, overrides);
}

/**
 * Which landing a person should get. The two specs are emphatic that Centre
 * Admin and Course Admin are separate places -- "never merge these two builds"
 * -- and one flat `admin` landing on a course-shaped screen is the bug this
 * whole model exists to fix.
 *
 * A custom role defaults to the centre-admin landing: every example in
 * for-claude-code-centre-owner-role-customizer.md ("Centre Director",
 * "Across-course Administrator") is a centre-wide variant, structurally
 * alongside Centre manager/observer/owner, not course-scoped the way
 * Course administrator is.
 */
/**
 * Where "Connect" takes an admin-family person: their own home.
 *
 * Ramy, 31 Aug 2026: "Connect takes you back to your home page. If you're a
 * trainee it takes you back to your landing page. If you're an ACT, if
 * you're an MCT, whatever. Same thing for the centre owner. You're logged in
 * as yourself. You don't need a Centre owner pill -- you just click on
 * Connect and it takes you back."
 *
 * This deliberately supersedes the 27 Aug rule that pinned the logo to
 * whichever section you were standing in. That rule existed because the logo
 * used to point at /dashboard, whose landing preference bounced anyone with
 * a centre role into /centre -- so it fixed the symptom by making the mark
 * section-local. One consequence, confirmed with him before changing it: an
 * owner clicking Connect from inside Course Admin now leaves Course Admin,
 * because that is what going home means.
 *
 * Owner first: someone holding centre_owner alongside other roles is an
 * owner, and the owner screen is theirs. platform_owner is handled by its
 * callers before this, since Command Center is not a centre screen at all.
 */
export function adminHomePath(roles: string[]): string {
  if (roles.includes("centre_owner")) return "/centre/owner";
  return landingFor(roles) === "course-admin" ? "/dashboard/admin" : "/centre";
}

export function landingFor(roles: string[]): "centre-admin" | "course-admin" | null {
  if (roles.length === 0) return null;
  if (roles.every((r) => r === "course_administrator")) return "course-admin";
  return "centre-admin";
}

/** Display label for a role, built-in or owner-defined custom. */
export function roleLabel(roleKey: string, customRoles: { role_key: string; label: string }[] = []): string {
  if (roleKey in CENTRE_ROLE_LABELS) return CENTRE_ROLE_LABELS[roleKey as CentreRole];
  return customRoles.find((r) => r.role_key === roleKey)?.label ?? roleKey;
}

/** Display label for a capability, built-in or owner-defined custom. */
export function capabilityLabel(capabilityKey: string, customCapabilities: { capability_key: string; label: string }[] = []): string {
  const builtIn = CAPABILITY_LABELS[capabilityKey as Capability];
  if (builtIn) return builtIn;
  return customCapabilities.find((c) => c.capability_key === capabilityKey)?.label ?? capabilityKey;
}

// Plain-language row labels for the customizer table -- Centre Owner
// Landing.dc.html's own transcription of Capability, one row each.
export const CAPABILITY_LABELS: Record<Capability, string> = {
  "course.create": "Create courses",
  "course.editRecord": "Edit course record",
  "course.reassignUnowned": "Reassign an unowned course",
  "roles.grant": "Invite / grant centre roles",
  "centre.settings.edit": "Centre settings & Drive",
  "payments.view": "View payments",
  "payments.edit": "Edit payments",
  "admissions.view": "View admissions",
  "admissions.manage": "Manage admissions",
  "volunteers.view": "View volunteers",
  "volunteers.manage": "Manage volunteers",
  "enrolment.view": "Enrolment & completion figures",
  "import.run": "Import candidates",
  "assessorPack.export": "Export assessor pack",
  "courseAdmin.view": "View course admin screens",
  "courseAdmin.invite": "Invite people to a course",
  "courseAdmin.groups": "Form TP groups",
  "courseAdmin.settings": "Course-level settings",
  "timetable.publish": "Publish timetable",
};

/**
 * The plain-language description shown on the Roles tab (role-strip) and in
 * the customizer's live preview -- generated from the exact same resolved
 * grant state both places read, so the two can never drift out of sync.
 * Mirrors Centre Owner Landing.dc.html's own describeRole().
 */
export function describeRoleCapabilities(
  roleKey: string,
  overrides: OverrideMatrix | undefined,
  customCapabilities: { capability_key: string; label: string }[] = []
): string {
  const allCaps: { key: string; label: string }[] = [
    ...(Object.keys(CAPABILITY_LABELS) as Capability[]).map((key) => ({ key, label: CAPABILITY_LABELS[key] })),
    ...customCapabilities.map((c) => ({ key: c.capability_key, label: c.label })),
  ];
  const fulls: string[] = [];
  const views: string[] = [];
  for (const cap of allCaps) {
    const grant = grantFor([roleKey], cap.key, overrides);
    if (grant === true) fulls.push(cap.label);
    else if (grant === "read") views.push(cap.label);
  }
  if (fulls.length === 0 && views.length === 0) return "No access to anything on this list.";
  let text = "";
  if (fulls.length) text += `Full access: ${fulls.join(", ")}. `;
  if (views.length) text += `View only: ${views.join(", ")}.`;
  return text.trim();
}
