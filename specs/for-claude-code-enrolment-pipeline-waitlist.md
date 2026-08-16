# Enrolment Forms, Admissions Pipeline, Waiting List — full design specs

## Shared tokens
- Fonts: Karla (400–700, body/UI), Newsreader (500/600, headlines)
- Page bg `oklch(92.5% 0.012 85)` · outer section bg `oklch(96.4% 0.014 85)` · card bg `oklch(99.2–99.5% 0.004–0.005 90)` · border `oklch(88–89.5% 0.012–0.016 82)`
- Ink `oklch(23.5% 0.017 65)` · muted `oklch(51% 0.017 70)` · warm headline ink `oklch(30% 0.042 58)`
- Teal `oklch(37.5–38% 0.058–0.072 195)` (primary/positive-progress) · Gold `oklch(60–63% 0.096–0.11 70–72)` (waiting/attention) · Red `oklch(45% 0.15–0.16 27)` (urgent/malpractice) · Green `oklch(48% 0.09 150)` (confirmed/good)
- All page widths 1560–1620px, 56px outer padding, 44px gap between major sections. Cards: 6–8px radius, colored top-spine (3px) or left-spine (3px) marks category/status.

---

## Enrolment Forms.dc.html — three signable documents, one screen each (1560px canvas)

**1a. AI-use disclaimer** (700px form + notes column, 22px gap)
Cambridge's own "Disclaimer for AI Use" (May 2024), verbatim, split into three lettered sections (A/B/C), each its own tinted card with a lettered chip, bullet list, and its own tick/checkbox:
- **A** (teal tint): "I understand that, on the CELTA course, I can use AI for the following purposes." — generate ideas for TP (texts, activities), initial research for written assignments incl. bibliography, proofread work. Tick: "I understand what I may use AI for."
- **B** (teal tint): "I understand that I need to reference use of generative AI in my work and I have been informed how to do so." — in-text citation (prompt, quoted text, tool, date) + reference list entry, APA recommended. Tick: "I have been shown how to reference AI use."
- **C** (gold tint): "I understand that the following will be treated as an attempt at malpractice and will result in failing the work" — generating a plan/analysis/assignment using AI; using AI outside section A's purposes; failing to acknowledge use. Tick: "I understand what counts as malpractice."

Sign block: "Type your full name to sign" → name field (Newsreader serif, teal-tinted border) → "Name, date and time are recorded. A copy is filed in your portfolio." → filled teal button "Sign the disclaimer".

**1b. Special consideration** (620px form + notes, declared at enrolment)
Headline "Is there anything we should know?" + paragraph on dyslexia/health/caring responsibilities, that it doesn't appear on the certificate. Two radio options: "Yes, there is something" / "No, nothing to declare" (teal accent). If yes: chip-select "What would help" (Extended time for assignments, Materials in advance, Written instructions, A quiet room for TP prep, Screen-reader friendly files, Something else), free-text "Tell us in your own words", dashed drop-zone "Attach a report or letter". Confidentiality note in teal-tinted box: "Only the course tutors and the centre see this... not sent to Cambridge unless an extension is later requested." CTA: "Send to the centre" / "Continue".

**1c. Raise a concern** (620px form + notes, internal complaints route)
Headline "Raise a concern" + "say it early" framing. Radio "Who should see this?": My tutor / The Main Course Tutor (teal) / The centre manager (gold, "independent of the teaching team"). Free-text "What has happened". Checkbox: "Send this anonymously — the centre manager sees the concern but not my name." CTA "Send to [route]". Below a divider: numbered escalation steps (1: centre reviews outside the teaching team, 2: Cambridge Helpdesk, 3: results disputes go through Cambridge appeals separately).

---

## Admissions Pipeline.dc.html (1620px, funnel dashboard)

**1a. Single-course pipeline**: headline "9 of 12 places paid for · 25 days to go" + 3 stat numbers (Places/Paid/At risk) top-right. 5-stage funnel bar (Applications → Interviewed → Offered → Deposit paid → Paid in full), each stage a clickable card sized proportional to its count, showing count (Newsreader 27px), a drop-off % badge, label, and sub-caption; selected stage gets colored spine/border. Below: 1.35fr/1fr split — left is a person-list table for the selected stage (name/meta, state, action e.g. "Chase"/"Book"/"Call"/"Remind"); right is a stack of alert cards (red/gold spine, left-border 3px) flagging expiring offers, waiting-list coverage, overdue balances.

**1b. Cross-course table**: header row (Course / Applied / Interv. / Offered / Deposit / Paid / Where it stands) over one row per open course, numeric cells tabular-nums, deposit/paid columns bolded in gold/green, verdict column in plain-language color-coded text (e.g. "3 short, 4 on the waiting list", "Full and paid").

Stage colors: Applications=muted, Interviewed/Offered=teal, Deposit=gold, Paid=green.

---

## Waiting List.dc.html (1400px canvas)

**1a. Ranked waiting table, per course**: course-tab row (one pill per course, count of people waiting, colored spine per course), then a dark-header table (# / Name / Waiting for / Interviewed / Why they are waiting / [action]) — header row bg `oklch(30% 0.042 58)`, cream text. Rows: rank number (Newsreader), clickable name (teal, opens application file drawer), course chips per person (tinted per course color), interview date, outcome pill + one-line reason, and a right-aligned "Offer the place" button (teal fill) when eligible, or a muted "blocked" reason (e.g. "Not interviewed") when not.
- Toggle top-right: "A place has come free" / "Course is full again", with a red "1 place free — [name] withdrew" status line.
- Clicking a name opens a dark-header **application file drawer**: 7 rows (application form, language awareness task, extended writing task, interview record, selection outcome, special arrangements, commitments and conduct) each with value + status pill (Complete/Read/Missing/Recorded/On file, colored green/gold/teal/muted).

**1b. Two side panels**: "Ranked by the centre, not by date" — 4 rules on ordering (interviewed+suitable first; a tutor can move someone up with a recorded reason; date is the tie-breaker; nobody sits on two lists silently). "The offer that expires" — a sample offer email preview (subject-style header, 3-paragraph body, tinted expiry-countdown box) with a **tweakable expiry-hours slider (default 48h, 12–120 range)**.

**1c. Three "after" cards**: what happens if the course starts and they're still waiting (stay on their chosen course; can ask to come off with one line; after two passed courses the centre proactively writes to them) — each a top-spine card (teal/gold/muted).

Footer: 3 note cards (left-spine, teal/gold/red) on why a waiting list must be an interviewed list, why withdrawal is the trigger event, and why "late" is a judgement call.

---

## Files included
`Enrolment Forms.dc.html`, `Admissions Pipeline.dc.html`, `Waiting List.dc.html` — full working source, verbatim copy and logic included below the spec.
