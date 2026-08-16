# Text-Based Teaching Input Session — full spec

Written 14 Aug 2026, for Claude Code. Repo: `ramysakr1-ux/celta-connect` @ `main`. Source: `Text-Based Teaching Input Session.dc.html`. A 45-minute loop-input session — staged exactly like the framework it teaches, so trainees do the tasks before the framework is ever named.

## Architecture
**Fixed 45-minute agenda** (6-column strip): Lead-in (2 min) → What is text-based teaching? (3 min, flip-card definition) → Match the terms (5 min, click-to-match 5 term–definition pairs) → Predict the staging (3 min, pair discussion, no right answer yet) → Read the text, check ideas (10 min, the staging explanation presented as reading text) → Detail questions (10 min, 6 click-to-reveal true/false cards) → Debrief: order the stages (10 min, click 4 shuffled stage-name cards into the correct order — the loop-input reveal, itself another loop-input exercise) → Trainer notes (2 min).

**Persistent UI**: Print button (top-right), "Staging example" toggle (reveals a full worked lesson-stage table at the bottom), watermark "TBL" (bottom-right), a reveal-answer-key control (term definitions + true/false answers, printable separately via a hidden `.answer-key-print` block shown only under `body.print-key`), and trainer notes (red-tinted reveal, 2 points).

**Term-matching mechanic**: click a left term, click a right definition; correct pairs lock green, wrong pairs shake red then reset. Right column is reversed so it isn't a visual 1:1 match.

**Debrief ordering mechanic**: 4 shuffled stage-name buttons; only the next-correct stage (per a fixed order) is accepted on click — a wrong click does nothing; locked-in stages turn green and get numbered.

**Trainer-only callout**: don't name "text-based teaching" until the debrief; keep the language-focus stage visibly tied back to the text — the detail trainees lose first.

## Content
- Lead-in prompt: think of the last coursebook lesson you did as a student — did it start from a grammar point or a text?
- Flip-card: "What makes a lesson text-based?" → a text drives the whole lesson — topic, language, and skills work all come from it.
- 5 terms: **Gist** (fast, single-pass reading/listening for the main idea), **Detail** (a slower, closer pass for specific information), **Authentic text** (a real text/recording made for real readers, not simplified), **Follow-on task** (a speaking/writing/discussion task responding to the text's content), **Lead-in** (a short task creating topic interest before the text appears).
- Staging text ("Staging a text-based lesson"): the lesson starts from a chosen text — selected for content and language together, not from a pre-chosen grammar point. Opens with a lead-in creating topic interest (often prediction from a title/image). A gist task follows, testing only global understanding: timed skim-reading, or hearing audio once. Only once gist is secure does a detail task follow, prompting a closer, slower pass. From there the lesson turns to language: target items are lifted straight from the text wherever they occur — often several items, not pre-selected to just one. Closes with a follow-on task responding to the text's content — discussion, role play, or writing. Everything in the lesson (topic, language, skills work) comes from that one text.
- 6 true/false detail questions: target language chosen before the text (**false** — text comes first, language is lifted from it); a gist task should be timed (**true**); every unknown word should be looked up before gist reading (**false** — only pre-teach words essential to understanding); detail tasks come before gist tasks (**false** — gist always comes first); the follow-on task should relate to the text's content (**true**); a text-based lesson can only use one language item from the text (**false** — it can use several, wherever they occur).
- Trainer notes: (1) watch for "PPP wearing a text-based costume" — some trainees pick the text last and force it to fit a language point they already chose; the text has to come first and genuinely drive everything else. (2) Language items can be plural — unlike PPP or Guided Discovery, a text-based lesson can lift more than one target item wherever it occurs; don't force it back down to a single point.
- Worked example ("a magazine article about changing city life"), 5-stage table: Lead-in (4′, predict content from photo/headline) → Gist task (6′, timed skim-read, one general question) → Detail task (8′, slower re-read for specifics) → Language focus (15′, comparative structures lifted from the article, unpacked with CCQs and practised) → Follow-on task (12′, students discuss how their own city has changed, using the target structures).

## Design tokens
Ink `oklch(23.5% 0.017 65)`, muted `oklch(51% 0.017 70)`, teal (accent throughout) `oklch(38% 0.072 195)`, gold (lead-in / staging-example toggle) `oklch(60% 0.11 70)` / amber label `oklch(44% 0.1 68)`, green (correct/matched) `oklch(48% 0.09 150)`, red (trainer notes / shake state) `oklch(45% 0.15 27)`, card `oklch(99.2% 0.005 90)`, border `oklch(88% 0.016 82)`, page bg `oklch(92.5% 0.012 85)`. Fonts: Karla (UI), Newsreader (headings/definitions).
