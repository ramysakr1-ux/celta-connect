# Dry run — a full mock course before anything real

The purpose is not a demo. It is to find what breaks before a real candidate is standing in front of a class, and to produce a timetable good enough to duplicate.

Distinct from the sales demo (`Demo Links.dc.html`): that one is a fictional centre for prospects, resets nightly, and never sends anything. This one is Ramy's own centre, runs for weeks, and is treated as real in every way except that nobody is certificated.

---

## The cohort

**Twelve candidates**, which is the shape most centres run and the one that stresses the model properly:

- Two TP groups of six.
- Each group splits into halves of three, teaching on alternate days.
- Twelve is also the double-marking threshold that requires **4 of each assignment** in the sample — worth exercising.

**Four tutors:**

- Ramy — **Main Course Tutor**, and simultaneously enrolled as a candidate so he sees both sides live. His trainee account must be a separate person record with its own email, never a role toggle: the point is to experience the trainee's real constraints, including not seeing provisional grades.
- Two more tutors — one **Assistant Course Tutor**, one **TP tutor**. Give them real logins so the handover, double-marking and chat rules are exercised by more than one person.
- Optionally a fourth as **input tutor**, to test that a tutor can hold a role without a TP group.

**Volunteer students**: two classes at different levels, six to eight each, so the level-alternation and the hours model get used.

**Deliberate awkward cases**, seeded from the start rather than added later:

| Case | Why |
|---|---|
| One candidate withdraws in week 2, before the entry form | Tests the internal-event branch and the emptied TP slot |
| One withdraws in week 3, after the entry form | Tests the Withdrawn outcome in the grades and the paused file |
| One defers past the halfway point | Tests the freeze, the destination course and the carried hours |
| One fails an assignment and resubmits | Tests the one-chance rule and the section-scoped resubmission |
| One triggers a plagiarism case that is **not** upheld | The commonest real outcome, and the one that must not leave a mark |
| One provisional grade written with a slash | Tests the justification gate before finalisation |
| One candidate at Fail risk | Tests the Stage 3 flag and the two-lessons-left warning |
| One tutor "leaves" mid-course | Tests handover, permanent signatures, and re-observation |

That is eight of twelve doing something interesting, which is unrealistic for a real course and exactly right for a test.

---

## The timetable is the real deliverable

A four-week full-time timetable that is genuinely good is worth more than the rest of the dry run, because most centres will duplicate it rather than build one.

Build it together, and treat it as a designed artefact:

- **Days as rows, time bands as columns**, with the admin and deadlines column leading — the app's existing orientation.
- Every band a real duration, not a placeholder.
- TP for both groups, on the alternating-halves pattern.
- Input sessions placed so the **criterion each one covers** lands before the TP where candidates are assessed on it. This is the thread the whole system runs on, and a timetable that gets it right teaches the model by itself.
- Assignment deadlines anchored where they must be: FOL after TP4, LFC after the last observed lesson.
- Tutorial slots at Stage 1, 2 and 3, with Stage 2 placed by **hours of assessed teaching**, not by the calendar.
- The assessor visit day.
- Study days, and at least one deliberate awkwardness — a public holiday, a room change, a mode switch — so the duplication logic is tested against something imperfect.

When it is right, mark it as a **template** in the centre shell. That is the artefact a new centre would want first.

---

## How to run it

**Do not compress it.** Run it across real days at real times if you can, or at minimum step through each day in order. The bugs live in sequence — a deadline landing before its lesson, an announcement firing on a date that moved, a rotation that recalculates when it should not.

**Do the work properly.** Write real feedback, real plans, real self-evaluations. Thin placeholder text will not reveal whether a form is the right shape, and the point of Ramy being a candidate is to feel how long a lesson plan actually takes to fill in at 11pm.

**Keep a running list of friction**, separate from bugs. "I could not find X" and "I had to type this twice" are more valuable than crashes, and they are the ones nobody reports later.

**Take it all the way to close-out.** Export, erase, duplicate. The end of the course is the least-tested and highest-stakes part of the system, and the only way to know the export is complete is to open the folder afterwards and try to find something in it.

---

## What to check at the end

1. Open the Drive export as if you were an assessor, and find one candidate's TP3 feedback. If it takes more than a minute, the folder structure is wrong.
2. Confirm the duplicated shell carries the timetable, resources, TP points, criteria and tutors — and no people.
3. Confirm the withdrawn and deferred candidates appear correctly in the grades report and the assessor pack.
4. Confirm the not-upheld plagiarism case left no mark on the candidate's outcome, and is still in the file.
5. Confirm nothing a candidate could see ever showed a provisional grade.

---

## The open question this answers

Whether to rent Connect to other centres or run it as one centre is not decided. The dry run informs it: running a full mock course is the fastest way to find out how much of the system is genuinely self-explanatory and how much depends on Ramy knowing why it works that way.

If the dry run needs frequent explanation, it is a single-centre tool for now. If it does not, it is a product.
