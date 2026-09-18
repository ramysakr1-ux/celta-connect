// The Course Story's data, verbatim from design_handoff_course_story/Course
// Story.dc.html (17 Sep 2026). Five lanes down the side, every day from the
// first application to the wipe across the top; every card names the demo it
// opens (`demo`, else the lane's own door) and, where a piece of work passes
// between people, the card it hands off to (`id` -> `to`, which is what the
// dashed arrows are drawn from). Edit the story here, not in the page.
import { inputSessionSlugForTitle } from "@/lib/input-session-registry-links";

export type LaneKey = "centre" | "tutors" | "candidate" | "volunteer" | "assessor";
export type CycleKey = "adm" | "tp" | "asg" | "close";

export interface Lane { label: string; who: string; colour: string; ink?: string; demo: string }
export interface Cycle { title: string; when: string; colour: string; ink?: string; steps: string[] }
export interface StoryNode {
  title: string; sub: string; cycle: CycleKey | null; flow: string | null; demo: string | null; id: string; to: string;
}
export interface StoryDay { eyebrow: string; label: string; cells: Partial<Record<LaneKey, StoryNode[]>>; day: number | null }
export interface StoryPhase { title: string; sub: string; days: StoryDay[] }

export const L: Record<LaneKey, Lane> = {
  centre: { label: 'Centre', who: 'Owner · manager · course admin · admissions', colour: 'oklch(45% 0.10 160)', demo: '/demo/centre-admin' },
  tutors: { label: 'Tutors', who: 'MCT · ACT', colour: 'oklch(38% 0.072 195)', demo: '/demo/trainer' },
  candidate: { label: 'Candidate', who: 'Six per group · ABC and DEF', colour: 'oklch(30% 0.042 58)', demo: '/demo/trainee' },
  volunteer: { label: 'Volunteer student', who: 'The learners being taught', colour: 'oklch(48% 0.08 140)', demo: '/demo/volunteer' },
  assessor: { label: 'Assessor', who: 'Cambridge · read-only', colour: 'oklch(60% 0.11 70)', ink: 'oklch(46% 0.10 70)', demo: '/demo/assessor' },
};
export const C: Record<CycleKey, Cycle> = {
  adm: { title: 'Admissions', when: 'weeks before Day 1', colour: 'oklch(42% 0.10 320)', steps: ['Apply', 'Written + spoken task', 'Interview', 'Offer', 'Deposit', 'Workspace released'] },
  tp: { title: 'Teaching practice', when: 'eight times', colour: 'oklch(23.5% 0.017 65)', steps: ['Plan', 'Teach', 'Self-evaluate', 'Tutor feedback', 'CELTA 5 updates', 'Starred points → next plan'] },
  asg: { title: 'Written assignments', when: 'four times', colour: 'oklch(42% 0.13 27)', steps: ['Released evening before', 'Q&A slot', 'Submit', 'Tutor feedback', 'Rewrite', 'Outcome'] },
  close: { title: 'Close-out', when: 'week 4 and after', colour: 'oklch(60% 0.11 70)', ink: 'oklch(46% 0.10 70)', steps: ['Stage tutorials', 'Grade form', 'Assessor visit', 'Grade approval', 'PDFs to the centre', 'Wipe'] },
};
export const GLASS: Record<LaneKey, string> = {
  centre: 'linear-gradient(160deg, oklch(96% 0.03 160 / 0.8), oklch(96% 0.03 160 / 0.4))',
  tutors: 'linear-gradient(160deg, oklch(95.5% 0.03 195 / 0.8), oklch(95.5% 0.03 195 / 0.4))',
  candidate: 'linear-gradient(160deg, oklch(100% 0 0 / 0.92), oklch(100% 0 0 / 0.55))',
  volunteer: 'linear-gradient(160deg, oklch(96% 0.03 140 / 0.8), oklch(96% 0.03 140 / 0.4))',
  assessor: 'linear-gradient(160deg, oklch(96% 0.045 80 / 0.8), oklch(96% 0.045 80 / 0.4))',
};
export const laneOrder: LaneKey[] = ['centre', 'tutors', 'candidate', 'volunteer', 'assessor'];

// A sixth door in the header that is not a sixth lane.
//
// The centre lane is four jobs in one row -- owner, manager, course admin,
// admissions -- and its door opens as the centre manager, which is right for
// most of the row. But the owner's own screen (the role builder, the
// custodial powers, branch visibility) had no door on this page at all, and
// the first card in the story is the owner creating the course. Ramy, 18 Sep
// 2026: "add centre owner too."
//
// Deliberately NOT in laneOrder: that list draws the grid's rows, and the
// owner is a person in the centre row, not a row of their own.
export const EXTRA_DOORS: { after: LaneKey; lane: LaneKey; label: string; demo: string }[] = [
  { after: 'centre', lane: 'centre', label: 'Centre owner', demo: '/demo/centre-owner' },
];
// node: [title, sub, cycle|null, flow|null, destination|null]
// id/to draw the arrows: `to` names the card this one hands off to.
//
// The destination is read two ways by the renderer (page.tsx). A path
// starting "/demo/" is a door of its own and is used whole -- the public
// journey pages do that. Anything else is a SCREEN: the card's own lane
// door, on that day, carrying ?to= so the visitor lands where the card says.
// "{me}" in a screen path resolves to the signed-in person's own id inside
// the demo route, so a card can name /portfolio/{me}/tp/3 without knowing
// who the demo seeded. Null means the lane's landing page, which is only
// right for a card whose subject IS that landing page.
const N = (title: string, sub: string, cycle: CycleKey | null = null, flow: string | null = null, demo: string | null = null, id = '', to = ''): StoryNode => ({ title, sub, cycle, flow, demo, id, to });
const D = (eyebrow: string, label: string, cells: Partial<Record<LaneKey, StoryNode[]>>, day: number | null = null): StoryDay => ({ eyebrow, label, cells, day });
const TPd = (n: number, g: string, level: string, id = '', to = '') => N(`TP${n} · ${g}`, `${level ? level + ' · ' : ''}three 45-min lessons, one tutor observing`, 'tp', 'feedback this afternoon', `/portfolio/{me}/tp/${n}`, id, to);
const TPobs = (n: number, g: string) => N(`Observes TP${n} · ${g}`, 'Peer observation task in the portfolio', 'tp', null, `/portfolio/{me}/tp/${n}`);
const FB = (n: number, id = '', to = '') => N(`TP${n} feedback`, 'Self-evaluations lead · planning and teaching points, criteria tagged', 'tp', 'CELTA 5 · starred points into the next plan', '/trainer/tp', id, to);
const PLAN = (n: number) => N(`Plans TP${n}`, 'Supervised planning · plan, LA, materials', 'tp', 'tutor reads the plan in the writer', `/portfolio/{me}/tp/${n}`);
// The volunteer's own page IS the screen this card names, so no ?to=.
const VOL = (lvl: string) => N(`In class · ${lvl}`, 'Join link opens 10 min before · register ticks hours', 'tp');
// The interactive session itself where the title is one of the 21 built
// ones -- through the curated title->slug list, never a fuzzy match, for
// exactly the reason that file gives: guessing wrong points a candidate at
// the wrong content. A title with no session stays on the tutor's hub.
const INPUT = (a: string, b?: string) => N(`Input · ${a}`, b ? `then ${b}` : 'Whole cohort', null, null, inputSessionSlugForTitle(a) ? `/input-sessions/${inputSessionSlugForTitle(a)}?back=/demo/story` : null);

export const phases: StoryPhase[] = [
  { title: 'Before the course', sub: 'Weeks before Day 1 · the centre fills the course and sets it up', days: [
    D('Weeks before', 'Applications open', { centre: [N('Creates the course', 'Dates, delivery mode, first tutor · New course wizard', 'adm', 'course admin takes over', '/demo/centre-owner?day=-28&to=/centre/courses/new', 'a0', 'a1'), N('Application page live', 'Centre-branded · honest availability count', 'adm', null, '/demo/journey/apply', 'a1', 'a2')], candidate: [N('Applies', 'Written task, speaking task, language awareness, acknowledgements', 'adm', 'lands in the pipeline', '/demo/journey/apply', 'a2', 'a3')], tutors: [N('Invited to the course', 'Joins via link · MCT or ACT', null)] }, -28),
    D('Days after', 'Selection', { centre: [N('Reads the tasks', 'AI reading suggests a lane · a person decides', 'adm', null, '/demo/centre-admin?stage=task_returned', 'a3', 'a4'), N('Interview slots', 'Generated from a weekly rule, not typed', 'adm', 'applicant picks their own time', '/demo/centre-admin?stage=interview_booked', 'a4', 'a5')], candidate: [N('Picks an interview time', 'Both time zones shown, theirs first', 'adm', null, '/demo/journey/interview', 'a5', 'a6'), N('Interviewed', 'Identity checked · fixed and drawn questions recorded', 'adm', null, '/demo/journey/interview-record')], tutors: [N('Interviews', 'Any verified tutor can be the interviewer', 'adm', 'record on the applicant', '/demo/journey/interview-record', 'a6', 'a7')] }, -21),
    D('Then', 'Offer and money', { centre: [N('Records the offer', 'Fee, currency, accept-by · emailed automatically', 'adm', null, '/demo/centre-admin?stage=offer_sent', 'a7', 'a8'), N('Deposit · plan', 'Card via provider or marked manually · instalments', 'adm', 'green light', '/demo/centre-admin?stage=accepted', 'a9', 'a10'), N('Releases the workspace', 'A reason from a fixed list · the invitation goes once', 'adm', 'candidate account exists', '/dashboard/admissions', 'a10', 'a11')], candidate: [N('Accepts the place', 'Same link becomes account setup once released', 'adm', null, '/demo/journey/offer', 'a8', 'a9'), N('Pre-course task', 'Own pace · reading list', null, null, '/portfolio/{me}/pre-course-task')], assessor: [N('Named on the course', 'Optional this early · shared field with the MCT', null)] }, -14),
    D('Day 0', 'Ready', { centre: [N('Entry form to Cambridge', 'Two or four weeks before · Connect tracks that it was sent', 'close', 'assessor pack reference', '/dashboard/admin/courses/{course}#entry-form')], tutors: [N('Builds the timetable', 'ABC Mon/Wed/Fri, DEF Tue/Thu · TP slots, inputs, deadlines', null, 'every screen reads this', '/trainer/timetable'), N('Sets assignment deadlines', 'Per event · Connect enforces the day', 'asg', null, '/trainer/assignments')], candidate: [N('Get to know you', 'Meets the group · first look at the workspace', null, null, '/portfolio/{me}/gtky', 'a11')], volunteer: [N('Signs up', 'Language, consent, six answers, a recording', null, 'transcript on the Volunteers page', '/demo/journey/volunteer-signup')] }, 0),
  ]},
  { title: 'Week 1', sub: 'Days 1–5 · first lessons, first feedback, first assignments', days: [
    D('Day 1 · Mon', 'Demo lessons', { tutors: [N('Course introduction', 'Timetable, CELTA 5, portfolio · whole cohort'), N('Demo lessons', 'Tutors teach · candidates observe with a task', null, null, '/trainer/timetable'), N('Unassessed teach', 'All six meet the learners', null, null, '/trainer/timetable')], candidate: [N('Observation task', 'First entry in the portfolio', null, null, '/portfolio/{me}/tp'), N('Meets the learners', 'Ten minutes each, unassessed', null, null, '/portfolio/{me}/timetable')], volunteer: [N('First class', 'Meets six trainee teachers · hours start')], centre: [N('Watches the roster', 'Read-only · who has joined, who has not', null, null, '/dashboard/admin/courses/{course}')] }, 1),
    D('Day 2 · Tue', 'TP1 · ABC', { candidate: [TPd(1, 'A · B · C', 'B1', 't1', 't1s'), TPobs(1, 'DEF observes'), N('Self-evaluation', 'Due 18:00 · before feedback', 'tp', null, '/portfolio/{me}/tp/1', 't1s', 't1f')], tutors: [FB(1, 't1f', 't2'), N('Releases A1', 'Focus on the Learner · evening before the Q&A', 'asg', 'candidate sees the brief and criteria', '/trainer/assignments', 'g1', 'g2')], volunteer: [VOL('B1')] }, 2),
    D('Day 3 · Wed', 'TP1 · DEF', { candidate: [TPd(1, 'D · E · F', 'B1'), N('A1 Q&A', 'Brief and criteria open · writing starts on the day set', 'asg', null, '/portfolio/{me}/assignments', 'g2', 'g3')], tutors: [FB(1), N('Releases A2 (LRT)', 'Language-related tasks · picker fields', 'asg', null, '/trainer/assignments')], volunteer: [VOL('B1')] }, 3),
    D('Day 4 · Thu', 'TP2 · ABC', { candidate: [TPd(2, 'A · B · C', 'B1', 't2'), PLAN(3), N('Consultation', 'Bookable slot with own tutor', null, null, '/portfolio/{me}/timetable')], tutors: [FB(2), INPUT('PPP', 'Text-based teaching')], volunteer: [VOL('B1')] }, 4),
    D('Day 5 · Fri', 'TP2 · DEF', { candidate: [TPd(2, 'D · E · F', 'B1'), N('Filmed observation 1', 'With task · portfolio entry', null, null, '/portfolio/{me}/timetable')], tutors: [FB(2), N('Marks A1 round 1', 'Criteria anchored inline · overall comment', 'asg', 'candidate reads feedback, rewrites', '/trainer/assignments', 'g3', 'g4')], centre: [N('Payments', 'Instalments due · missed ones flag on the overview', null, null, '/centre')], volunteer: [VOL('B1'), N('RSVP for next week', 'Coming · can\u2019t make it · no reply')] }, 5),
  ]},
  { title: 'Week 2', sub: 'Days 6–10 · Stage 2 reports, tutorials, the level changes', days: [
    D('Day 6 · Mon', 'TP3 · ABC', { candidate: [TPd(3, 'A · B · C', 'B1'), N('A1 rewrite', 'Editable round 2 · withdraw before resubmitting', 'asg', null, '/portfolio/{me}/assignments', 'g4', 'g5')], tutors: [FB(3), INPUT('Connected speech', 'Stress and intonation')], volunteer: [VOL('B1')] }, 6),
    D('Day 7 · Tue', 'TP3 · DEF', { candidate: [TPd(3, 'D · E · F', 'B1'), N('Filmed observation 2', 'With task', null, null, '/portfolio/{me}/timetable')], tutors: [FB(3), N('A1 outcome', 'To standard · not to standard · one resubmission', 'asg', 'CELTA 5 record', '/trainer/assignments', 'g5')], volunteer: [VOL('B1')] }, 7),
    D('Day 8 · Wed', 'TP4 · ABC', { candidate: [TPd(4, 'A · B · C', 'B1'), N('A2 (LRT) in progress', 'Due week 4', 'asg', null, '/portfolio/{me}/assignments')], tutors: [FB(4), N('Writes Stage 2 reports · ABC', 'Own time · progress against criteria', 'close', 'tutorial tomorrow', '/trainer/roster', 's1', 's2')], volunteer: [VOL('B1')] }, 8),
    D('Day 9 · Thu', 'TP4 · DEF', { candidate: [TPd(4, 'D · E · F', 'B1'), N('Stage 2 tutorial', 'One-to-one with own tutor · trajectory', 'close', null, '/portfolio/{me}/timetable', 's3')], tutors: [FB(4), N('Stage 2 tutorials', 'ABC then DEF · report signed in CELTA 5', 'close', 'formal letter if at risk', '/trainer/timetable', 's2', 's3')], volunteer: [VOL('B1'), N('Level ends', 'Certificate hours banked')] }, 9),
    D('Day 10 · Fri', 'New level', { tutors: [N('Demo lessons · new level', 'Tutors teach the new class', null, null, '/trainer/timetable'), N('Marking day', 'Supervised · assignments · tutors marking', 'asg', null, '/trainer/assignments')], candidate: [N('Unassessed teach · GTKY', 'Meets the new learners', null, null, '/portfolio/{me}/gtky'), N('Stage 1 tutorials', 'One-to-one, own tutor', 'close', null, '/portfolio/{me}/timetable')], volunteer: [N('New class signs up', 'Second level · same link shape')], centre: [N('Concerns route', 'Anything routed past the tutors lands here only', null, null, '/centre/concerns')] }, 10),
  ]},
  { title: 'Week 3', sub: 'Days 11–15 · own topics, supervised review, Stage 3 by invitation', days: [
    D('Day 11 · Mon', 'TP5 · ABC', { candidate: [TPd(5, 'A · B · C', 'A2'), N('Picks TP7/8 topics', 'Syllabus grid · tutor may restrict types', 'tp', null, '/dashboard/trainee/plan/syllabus-grid', 'y1', 'y2')], tutors: [FB(5), INPUT('Functional language', 'Test-Teach-Test')], volunteer: [VOL('A2')] }, 11),
    D('Day 12 · Tue', 'TP5 · DEF', { candidate: [TPd(5, 'D · E · F', 'A2')], tutors: [FB(5), N('Releases A3', 'Lessons from the classroom', 'asg', null, '/trainer/assignments')], volunteer: [VOL('A2')] }, 12),
    D('Day 13 · Wed', 'TP6 · ABC', { candidate: [TPd(6, 'A · B · C', 'A2'), N('Syllabus planning · ABC', 'Own TP7/8 lessons planned', 'tp', null, '/dashboard/trainee/plan/syllabus-grid', 'y2')], tutors: [FB(6), INPUT('Lesson framework', 'Teaching listening')], volunteer: [VOL('A2')] }, 13),
    D('Day 14 · Thu', 'TP6 · DEF', { candidate: [TPd(6, 'D · E · F', 'A2'), N('Syllabus planning · DEF', 'Own TP7/8 lessons planned', 'tp', null, '/dashboard/trainee/plan/syllabus-grid')], tutors: [FB(6), INPUT('Language practice', 'Drilling techniques')], volunteer: [VOL('A2')] }, 14),
    D('Day 15 · Fri', 'Review day', { candidate: [N('Supervised review', 'Presenting language · phonology · classroom management · submit for tutor check', null, null, '/portfolio/{me}/timetable'), N('Stage 3 tutorial', 'By invitation only', 'close', null, '/portfolio/{me}/timetable')], tutors: [N('Stage 3 tutorials', 'Those at risk · letter issued if needed', 'close', 'assessor pack shows the letter', '/trainer/timetable'), N('Self study', 'The afternoon is theirs -- assignments, planning, reading')], centre: [N('Grade form prep', 'Centre grade form due 2–3 days before the visit', 'close', null, '/dashboard/admin/courses/{course}')] }, 15),
  ]},
  { title: 'Week 4', sub: 'Days 16–20 · final assessed lessons, deadlines, the visit, the close', days: [
    D('Day 16 · Mon', 'TP7 · ABC', { candidate: [TPd(7, 'A · B · C', 'A2 · own topic'), N('Filmed observations 4 & 5', 'With task', null, null, '/portfolio/{me}/timetable')], tutors: [FB(7), N('Assessor meeting', 'Ahead of the visit · pack and sample agreed', 'close', 'assessor pack opens', '/trainer/assessor', 'c1', 'c2')], assessor: [N('Pack opens', 'Read-only · requirements, candidate readiness, double-marking sample', 'close', null, null, 'c2', 'c3')], volunteer: [VOL('A2')] }, 16),
    D('Day 17 · Tue', 'TP7 · DEF', { candidate: [TPd(7, 'D · E · F', 'A2 · own topic'), N('A2 (LRT) due · DEF', 'Deadline time set on the timetable', 'asg', null, '/portfolio/{me}/assignments')], tutors: [FB(7), N('Marks A2', 'Double-marking on the sample', 'asg', 'assessor reads both marks', '/trainer/assignments')], assessor: [N('Reads candidates', 'Application files · lesson plans · CELTA 5 · in Handbook order', 'close', null, null, 'c3', 'c5')], volunteer: [VOL('A2')] }, 17),
    D('Day 18 · Wed', 'TP8 · ABC', { candidate: [TPd(8, 'A · B · C', 'Final assessed', 't8', 't8f'), N('A2 (LRT) due · ABC', 'Deadline time set on the timetable', 'asg', null, '/portfolio/{me}/assignments')], tutors: [N('TP8 feedback · written only', 'No live session for the final TP', 'tp', 'CELTA 5 final entries', '/trainer/tp', 't8f', 't8p'), N('Portfolio check · ABC', 'Every field, every signature', 'close', null, '/trainer/roster', 't8p', 'c4b')], centre: [N('Centre grade form', 'Submitted in Appian · Connect marks who did it', 'close', 'assessor report can open', '/dashboard/admin/courses/{course}', 'c4', 'c5')], volunteer: [VOL('A2')] }, 18),
    D('Day 19 · Thu', 'TP8 · DEF', { candidate: [TPd(8, 'D · E · F', 'Final assessed'), N('A4 (LFC) due · 09:00', 'Lessons from the classroom', 'asg', null, '/portfolio/{me}/assignments'), N('Professional development', 'Career advice · whole cohort', null, null, '/portfolio/{me}/timetable')], tutors: [N('Final portfolio check', 'Every field, every signature', 'close', null, '/trainer/roster'), N('Grades report', 'Provisional grades · cohort sheet', 'close', 'grading meeting', '/trainer/grades-report', 'c4b', 'c5')], assessor: [N('Visit day', 'Grading meeting · report written in Appian', 'close', 'centre grade approval form', null, 'c5', 'c6')], volunteer: [VOL('A2'), N('Last class', 'Hours toward the certificate')] }, 19),
    D('Day 20 · Fri', 'Course close', { tutors: [N('Course close', 'Whole cohort · nothing about grades is said', null, null, '/trainer/timetable'), N('Close-out checklist', 'Every record complete · export ready', 'close', null, '/trainer')], candidate: [N('Course finished', 'Workspace says so · no grade shown until Cambridge confirms', 'close')], centre: [N('Grade approval form', 'After the assessor\u2019s report · Appian', 'close', 'Cambridge confirms', '/dashboard/admin/courses/{course}', 'c6', 'c7')], volunteer: [N('Certificate', 'If the hours threshold is reached', null, null, '/demo/journey/volunteer-certificate')] }, 20),
  ]},
  { title: 'After the course', sub: 'The centre keeps everything; the course keeps nothing', days: [
    D('Days after', 'Confirmation', { centre: [N('Cambridge confirms grades', 'Close-out tick -- the MCT or the centre, whoever hears first', 'close', null, '/dashboard/admin/courses/{course}', 'c7', 'c8')], tutors: [N('Issues letters', 'Reference letters · formal notices on record', 'close', null, '/trainer/roster')], candidate: [N('Sees the grade', 'Only now', 'close', null, null, 'c8b')] }, 23),
    D('Then', 'Export', { centre: [N('PDFs to the centre\u2019s Drive', 'Plan + self-eval + feedback per TP · assignment rounds · CELTA 5 · letters', 'close', 'centre\u2019s own template document', '/centre/settings', 'c8', 'c9'), N('Assessor history', 'Handbook 13.3 / 13.8 · visible, not enforced', 'close', null, '/centre/assessor-history')], assessor: [N('Pack closes', 'When the working copy is cleared \u2014 the centre keeps the pack', 'close')] }, 25),
    D('Then', 'Wipe', { centre: [N('Course working data wiped', 'The shell survives; join links say "closed", not "broken"', 'close', null, '/dashboard/admin/courses/closed', 'c9'), N('Duplicate for next time', 'From the course list · TP points and briefs already shared centre-wide', null, null, '/dashboard/admin')], volunteer: [N('Pool remembers them', 'One person, many courses · hours carry over')], candidate: [N('Link says the course has closed', 'With the centre\u2019s email as the way out')] }, 40),
  ]},
];
