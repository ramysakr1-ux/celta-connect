// Real assignment text for the seeded submissions.
//
// Every submitted assignment carried one generated sentence per section --
// the section's own instruction with "Amara answers this from the course so
// far" bolted on. Word counts read 41, 48, 96 against a 750-1,000 range, so
// nothing that depends on the length of real work could be looked at: the
// budget bar, the word-count criterion, the tutor's reading experience, the
// cover sheet.
//
// Ramy, 13 Sep 2026: "the 48 words is seeded -- fill in real submissions."
//
// So: real CELTA assignments, written to the criteria, 750-1,000 words each.
// TWO variants per assignment type, rotated by candidate, because eleven
// identical submissions would (correctly) light up the plagiarism scanner
// that runs on every submission. Focus on the Learner additionally takes the
// candidate's own learner name and L1 so no two profiles read the same.
//
// Keyed by SECTION KEY, because a centre's own brief decides the sections --
// Elmswood's Focus on the Learner came from an uploaded PDF and has
// different keys from the default brief. A key with no text here is left
// alone rather than filled with something generic.

/** Learners a candidate might profile, one per candidate, so no two match. */
export const LEARNERS = [
  { name: "Yusuf", l1: "Turkish", country: "Türkiye", age: 34, job: "a hotel receptionist" },
  { name: "Marta", l1: "Polish", country: "Poland", age: 27, job: "a dental nurse" },
  { name: "Camila", l1: "Spanish", country: "Colombia", age: 22, job: "a business student" },
  { name: "Aiko", l1: "Japanese", country: "Japan", age: 41, job: "an accountant" },
  { name: "Hassan", l1: "Arabic", country: "Egypt", age: 19, job: "an engineering student" },
  { name: "Elif", l1: "Turkish", country: "Türkiye", age: 30, job: "a pharmacist" },
  { name: "Dmytro", l1: "Ukrainian", country: "Ukraine", age: 36, job: "a lorry driver" },
  { name: "Bruna", l1: "Portuguese", country: "Brazil", age: 25, job: "a graphic designer" },
  { name: "Nadia", l1: "Russian", country: "Kazakhstan", age: 45, job: "a school administrator" },
  { name: "Thanh", l1: "Vietnamese", country: "Vietnam", age: 23, job: "a nursing student" },
  { name: "Karim", l1: "Arabic", country: "Morocco", age: 38, job: "a chef" },
  { name: "Sofia", l1: "Italian", country: "Italy", age: 29, job: "a physiotherapist" },
];

// --- Focus on the Learner, Elmswood's four-section brief ------------------

function folElmswood(L, variant) {
  const past = variant === 0;
  return {
    learner_profile: `${L.name} is ${L.age}, from ${L.country}, and works as ${L.job}. ${L.l1} is ${L.name}'s first language, and this is the first time ${L.name} has studied English in a classroom since school. The group is pre-intermediate (B1 on the CEFR), eight learners, mixed ages from nineteen to forty-five, meeting four evenings a week after work.

${L.name} sits near the front, always arrives early, and writes down almost everything that goes on the board — including things that were only meant as a passing example. In the three lessons I have observed and the two I have taught, ${L.name} has volunteered an answer in open class twice, but in pairwork speaks continuously and at length. That gap between the two settings is the single most striking thing about ${L.name} as a learner, and it shaped what I have chosen to focus on below.

${L.name} learns by writing and by rule: after a clarification stage, ${L.name} will often ask "so, always this form?" and want the boundary drawn. Harmer (2015, p. 88) describes this preference as a legacy of grammar-translation instruction, which matches what ${L.name} has told me about school. It is not a weakness, but it does mean that a guided-discovery stage which leaves the rule implicit tends to leave ${L.name} uncertain rather than confident.`,

    needs_and_motivation: `${L.name}'s reason for studying is specific and immediate. As ${L.job}, ${L.name} deals with English speakers most working days and describes the problem as "I understand, but I answer slowly." The goal is not an exam; it is being able to handle a real exchange without rehearsing it first. That makes fluency and automaticity the priority over accuracy in most contexts, which is worth saying plainly because ${L.name}'s own instinct is the opposite — to stop and correct the form before continuing.

Motivation is high and instrumental in Gardner and Lambert's sense, but there is an affective factor too: ${L.name} is visibly uncomfortable being wrong in front of the group, which explains the open-class silence. Anything I plan for ${L.name} needs to protect that. Pairwork, rehearsal time before nomination, and delayed correction rather than on-the-spot correction all lower the cost of an error, and I have seen all three work with ${L.name} already.

In terms of skills, listening is the weakest area — ${L.name} reports understanding recordings far less well than face-to-face speech, which is a connected-speech problem rather than a vocabulary one. Reading is the strongest. Writing is barely needed for work but ${L.name} wants it anyway, for emails.`,

    diagnosis_of_difficulties: past
      ? `The grammar area ${L.name} finds most difficult is the **past simple with irregular verbs in question and negative forms**. Two examples from ${L.name}'s own speech, recorded while monitoring on Tuesday:

* "Where you went at the weekend?" — the auxiliary is omitted and the lexical verb carries the past marking.
* "I didn't went to the party." — the auxiliary is present but the lexical verb is still marked for past, so the form is doubly marked.

These are opposite errors from the same cause: the rule that *did* carries the tense and the main verb reverts to the base form has not yet become automatic. ${L.name} can state the rule when asked, which confirms this is a proceduralisation problem, not a knowledge one (Thornbury, 1999, p. 27).

The pronunciation area is the **/θ/ and /ð/ contrast**, which ${L.l1} does not have. ${L.name} produces /t/ for /θ/ and /d/ for /ð/ consistently:

* "I *tink* so" for "I think so" — /tɪŋk/ for /θɪŋk/
* "*dis* one" for "this one" — /dɪs/ for /ðɪs/

Neither causes a breakdown in communication on its own, but "think/tink" and "this/dis" both occur constantly in the transactional language ${L.name} needs at work, and the substitution is consistent enough to be noticed by listeners.`
      : `The grammar area ${L.name} finds most difficult is the **present perfect for experience, in contrast with the past simple**. Two examples from ${L.name}'s own speech, taken from my monitoring notes on Wednesday:

* "I never went to London." — where the meaning was experiential ("I have never been"), the past simple was used with no time reference.
* "I have seen that film last year." — a specified past time attached to a present perfect form.

The two errors are the same problem seen from either side: the boundary between finished time and unfinished time has not been drawn. ${L.name}'s first language marks aspect differently, and Swan and Smith (2001) note this as a persistent area for exactly this L1 group.

The pronunciation area is **the weak form of *have* in present perfect questions and short answers**. ${L.name} produces the strong form /hæv/ in every position:

* "Have you ever been to Spain?" — /hæv juː/ rather than /həv juː/ or /əv juː/
* "Yes, I have been." — with /hæv/ stressed, where the natural contour stresses *been*.

The result is that ${L.name} sounds emphatic where no emphasis is intended, and — more importantly for listening — does not recognise the weak form when a speaker uses it, which is part of why recordings are harder than face-to-face speech.`,

    remedial_activities: past
      ? `**Activity 1 — for the past simple question and negative forms.** A running-dictation and reordering task adapted from *Grammar Practice Activities* (Ur, 2009, p. 141). Strips of paper around the room carry scrambled past simple questions ("did / where / you / go / weekend / at the / ?"). In pairs, one learner runs, reads, returns and dictates; the other writes and reorders. The rationale for ${L.name} specifically: it is a written, rule-focused task, which suits how ${L.name} prefers to learn, but it is done under time pressure and with a partner, so the form has to be produced quickly rather than deliberated over. It ends with the pairs asking each other the questions, which moves it from manipulation to use.

I would follow it with a delayed correction slot on the board rather than correcting during the running stage — ${L.name} will not take risks if errors are picked up publicly in the moment.

**Activity 2 — for /θ/ and /ð/.** A minimal-pair discrimination and production sequence: first listening ("think/tink", "they/day", "three/tree") with learners holding up A or B cards, then production in pairs with a mirror, then a short personalised sentence each learner writes and says. The mirror matters for ${L.name} — the articulation is visible, tongue between the teeth, and seeing it is more useful than hearing it for a sound that does not exist in ${L.l1}. Kelly (2000, p. 49) recommends exactly this visual route for interdental fricatives.

Both activities are pair-based and neither requires ${L.name} to be right in front of the whole group, which is the condition ${L.name} performs worst under.`
      : `**Activity 1 — for the present perfect / past simple boundary.** A "Find someone who has…" mingle adapted from *Teaching English Grammar* (Scrivener, 2010, p. 172), but with a second stage added. Learners mingle asking "Have you ever…?" questions; when they find someone, they must follow up with two past simple questions ("When did you go? Who with?"). The follow-up is the point: it forces the switch from unfinished to finished time in the same conversation, which is where the boundary actually lives. The rationale for ${L.name} is that it makes the contrast experiential rather than explained — and ${L.name} can already state both rules separately.

I would board the two forms side by side afterwards with a timeline, because ${L.name} will want the boundary drawn explicitly before feeling secure, and there is no reason to withhold it at that point.

**Activity 2 — for the weak form of *have*.** A listening-first sequence. Learners hear six short exchanges at natural speed and simply count how many words they hear in each — a technique from *Sound Foundations* (Underhill, 2005, p. 61) that surfaces the gap between what is said and what is heard. Then they see the transcript, mark the weak forms, and drill the exchanges in pairs, backchaining from the end.

This addresses ${L.name}'s stated problem directly: the difficulty is recognition before production. Drilling alone would improve how ${L.name} sounds without helping ${L.name} understand recordings, which is the actual need.

**References**
Harmer, J. (2015) *The Practice of English Language Teaching*. 5th edn. Pearson.
Kelly, G. (2000) *How to Teach Pronunciation*. Pearson.
Scrivener, J. (2010) *Teaching English Grammar*. Macmillan.
Swan, M. and Smith, B. (2001) *Learner English*. 2nd edn. CUP.
Thornbury, S. (1999) *How to Teach Grammar*. Pearson.
Underhill, A. (2005) *Sound Foundations*. Macmillan.
Ur, P. (2009) *Grammar Practice Activities*. 2nd edn. CUP.`,
  };
}

// --- Focus on the Learner, the default five-section brief ------------------

function folDefault(L, variant) {
  const four = folElmswood(L, variant);
  return {
    tp_group: `${four.learner_profile}\n\n${four.needs_and_motivation}`,
    grammar_problem: four.diagnosis_of_difficulties.split("The pronunciation area")[0].trim(),
    pronunciation_problem: "The pronunciation area" + four.diagnosis_of_difficulties.split("The pronunciation area")[1],
    grammar_task: four.remedial_activities.split("**Activity 2")[0].trim(),
    pronunciation_task: "**Activity 2" + four.remedial_activities.split("**Activity 2")[1],
  };
}

// --- Language Related Tasks ------------------------------------------------

const LRT = [
  {
    pick_items: `From Category A (grammar) I have chosen **"I've been living here for three years"** (present perfect continuous for unfinished time) and **"He must have missed the train"** (modal perfect for deduction about the past). From Category B (lexis) I have chosen **"to put someone off"** (phrasal verb, meaning to deter or discourage) and **"a hectic week"** (adjective + noun collocation).

All four are from Unit 7 of the group's coursebook and appeared in the reading text the class had already met, so each is presented in a context the learners have seen.`,
    meaning: `**"I've been living here for three years."** The action began in the past, has continued without interruption to the present moment, and is expected to continue. The emphasis is on the duration of the activity rather than on a completed result.

**"He must have missed the train."** The speaker is drawing a confident conclusion about a past event on the basis of present evidence. It is not an obligation; *must* here expresses near-certainty, and the speaker has not witnessed the event.

**"to put someone off."** To cause someone to lose enthusiasm for something, or to deter them from doing it. Here it is used with an object: "the price put me off."

**"a hectic week."** A week that was extremely busy and rushed. *Hectic* carries a negative, exhausted connotation that *busy* does not.`,
    clarification: `**Present perfect continuous.** Context: a photograph of my own flat, and the question "How long do you think I have lived here?" A timeline on the board with an arrow starting three years ago and continuing past NOW.
CCQs: *Do I live here now?* (Yes.) *Did I live here three years ago?* (Yes.) *Is the living finished?* (No.) *Am I talking about how long, or how many times?* (How long.)

**Modal perfect for deduction.** Context: a colleague is not at a meeting; his coat is gone and the train is cancelled.
CCQs: *Do I know he missed the train?* (No.) *Am I sure, or am I guessing?* (Guessing, but almost sure.) *Is the train now, or before?* (Before.)

**"put someone off."** Context: a picture of a very expensive menu.
CCQs: *Did I want to eat there at first?* (Yes.) *Do I want to now?* (No.) *What changed my mind?* (The price.)

**"hectic."** Personalised example: "I taught three lessons, wrote an assignment and moved flat — all last week."
CCQs: *Was I busy?* (Yes.) *Was I calm?* (No.) *Was it pleasant?* (Not really.)`,
    form: `**"I've been living here for three years."**
Subject + *have/has* + *been* + verb-*ing* + (complement).
Contracted in speech: *I've*, *he's*, *we've*. Negative: *I haven't been living*. Question: *How long have you been living here?* Note that *for* takes a period and *since* takes a point in time.

**"He must have missed the train."**
Subject + *must* + *have* + past participle. *Must* is invariable — no third-person -s, no *to*. The negative of deduction is *can't have*, not *mustn't have*, which is a common learner error.

**"to put someone off."**
Separable multi-word verb: *put someone off* / *put off someone* are both possible with a noun object, but with a pronoun object only *put me off* is possible, never *put off me*.

**"a hectic week."**
Adjective + noun. *Hectic* is gradable (*fairly hectic*, *absolutely hectic* is less natural) and is used attributively and predicatively: *a hectic week*, *the week was hectic*.`,
    pronunciation: `**"I've been living here for three years."**
/aɪv bɪn ˈlɪvɪŋ hɪə fə θriː jɪəz/
*Been* is weak: /bɪn/, not /biːn/. *For* is weak: /fə/. The stress falls on *living* and *three*. Learners typically stress *been* and produce the strong /fɔː/, which sounds unnatural and marks the utterance as non-native more than any grammatical error would.

**"He must have missed the train."**
/hi ˈmʌstəv ˈmɪst ðə treɪn/
*Must have* reduces to /ˈmʌstəv/ and is very often heard as "musta". Learners who have only seen this written produce /mʌst hæv/ with two strong forms, and — more importantly — fail to recognise /ˈmʌstəv/ when listening.

**"to put someone off."** /tə pʊt ˈsʌmwʌn ɒf/ — the stress is on the particle *off*, which is the general rule for separable multi-word verbs and worth drawing attention to.

**"a hectic week."** /ə ˈhektɪk wiːk/ — stress on the first syllable of *hectic*; learners whose L1 stresses finals may produce /hekˈtɪk/.`,
    appropriacy: `The present perfect continuous and *must have* are both neutral in register and appear freely in speech and writing.

*"Put someone off"* is informal to neutral; a formal complaint would use *"I was deterred by the price"*. *"Hectic"* is informal and conversational — a report would say *"a demanding week"*.`,
    problems: `**Meaning.** Learners confuse the present perfect continuous with the present continuous ("I am living here for three years"), because both describe something ongoing. *Solution:* contrast the two on one timeline and CCQ the start point — *When did it start? Is the start important?*

Learners read *must have* as past obligation — "I must have gone to the dentist yesterday" for "I had to go". *Solution:* a context with visible evidence and no obligation reading, contrasted directly with *had to*.

**Form.** The double auxiliary in *have been living* is the commonest form error — learners drop *been*. *Solution:* finger correction on the five elements, rebuilding the sentence one word at a time.

With *must have*, learners produce *must to have* or *must has*. *Solution:* board the form with *must* boxed as invariable, and drill the contracted /ˈmʌstəv/ so the *have* is never given a life of its own.

With the phrasal verb, learners produce *put off me*. *Solution:* a pronoun-position substitution drill.

**Pronunciation.** The weak forms are the main problem, and a listening problem before a speaking one. *Solution:* a counting-the-words task on a natural-speed recording, then backchained drilling.

**Reference:** Parrott, M. (2010) *Grammar for English Language Teachers*. 2nd edn. CUP.`,
  },
  {
    pick_items: `From Category A (grammar) I have chosen **"If I had known, I would have called you"** (third conditional) and **"She's used to working nights"** (*be used to* + gerund). From Category B (lexis) I have chosen **"to come across as"** (to give a particular impression) and **"a narrow escape"** (a noun collocation meaning a situation where something bad was only just avoided).

All four come from the Unit 9 listening the group worked with last week, so each is recycled from a context they have met rather than presented cold.`,
    meaning: `**"If I had known, I would have called you."** A past situation that did not happen and its imagined past result, which therefore did not happen either. The speaker did not know, and did not call. It often carries regret.

**"She's used to working nights."** She has done it enough times that it is now normal for her and no longer difficult. This describes a present state of familiarity, not a past habit.

**"to come across as."** To give other people a particular impression, often unintentionally, and often different from how the person actually is.

**"a narrow escape."** A situation where something unpleasant very nearly happened but was avoided.`,
    clarification: `**Third conditional.** Context: a short anecdote — I walked past a friend in the street last week without saying hello, because I did not have my glasses on.
CCQs: *Did I see my friend?* (No.) *Did I say hello?* (No.) *Is this about the past or the future?* (Past.) *Can I change it now?* (No.)

**"be used to" + gerund.** Context: a nurse on her fourth year of night shifts, with a picture.
CCQs: *Does she work nights?* (Yes.) *Was it difficult at first?* (Yes.) *Is it difficult now?* (No.) *Am I talking about now, or about the past?* (Now.)
Contrast immediately with *used to work nights* — CCQ: *Does she work nights now?* (No.) The two are a well-known trap and separating them is the whole clarification.

**"come across as."** Context: two photos of the same person — one in an interview looking stern, one laughing with friends.
CCQs: *In the first photo, how does he seem?* (Unfriendly.) *Is he really unfriendly?* (We don't know.) *Is this about how he seems, or how he is?* (How he seems.)

**"a narrow escape."** Context: a photo of a tree fallen across an empty parked car's bonnet, missing the cabin.
CCQs: *Did something bad happen?* (Almost.) *Did it actually happen?* (No.) *Was it close?* (Very.)`,
    form: `**"If I had known, I would have called you."**
*If* + subject + *had* + past participle, + subject + *would have* + past participle.
Contracted in speech throughout: *If I'd known, I'd have called you*. The clauses can be inverted, in which case the comma disappears: *I would have called you if I had known*. *Would* can be replaced by *might* or *could* to soften the certainty of the result.

**"She's used to working nights."**
Subject + *be* + *used to* + gerund (or noun phrase). *Be* carries the tense: *she was used to*, *she'll be used to*. Distinguish from *used to* + infinitive (past habit), where there is no *be* and no gerund.

**"to come across as."** Verb + particle + *as* + adjective or noun phrase. Inseparable: *he comes across as arrogant*, never *comes arrogant across*.

**"a narrow escape."** Adjective + noun, fixed. Usually with *have*: *we had a narrow escape*. *Close* also collocates (*a close escape*) but *narrow* is the more frequent.`,
    pronunciation: `**"If I had known, I would have called you."**
/ɪf aɪd ˈnəʊn aɪd əv ˈkɔːld juː/
Almost everything reduces. *I had* → /aɪd/, *would have* → /aɪd əv/ or "I'd've". The two stressed syllables in the whole sentence are *known* and *called*. Learners produce five or six full forms, which is not only unnatural but makes the tense itself hard for them to hear in other people's speech.

**"She's used to working nights."**
/ʃiːz ˈjuːst tə ˈwɜːkɪŋ naɪts/
Note /juːst/ with a voiceless /s/ — not /juːzd/. This is the form difference that carries the meaning difference from *used* as a normal past verb, and learners regularly voice it.

**"to come across as."** /tə kʌm əˈkrɒs æz/ — stress on *across*; the *as* is weak, /əz/.

**"a narrow escape."** /ə ˈnærəʊ ɪˈskeɪp/ — stress on *nar-* and *-scape*.`,
    appropriacy: `The third conditional and *be used to* are both neutral and appear across registers, though the full uncontracted third conditional is largely written or emphatic.

*"Come across as"* is neutral-to-informal and common in speech, including professional contexts such as interview feedback. *"A narrow escape"* is neutral but idiomatic, and commoner in narrative than in formal writing.`,
    problems: `**Meaning.** The commonest problem with the third conditional is learners using it for real past possibilities ("If I had time yesterday, I called you"), mixing it with the second conditional. *Solution:* a sorting task with real and unreal situations, CCQing *Did it happen?* on each before any form work.

*Be used to* against *used to* is the classic confusion — "She used to working nights". *Solution:* clarify both in the same lesson, two columns on the board, with a CCQ on each separating present state from past habit.

**Form.** Learners omit *have* in the result clause ("I would called you") or double the past ("If I would have known"), the latter being extremely persistent. *Solution:* finger correction, and a board record that boxes *would have* as a single chunk so it is learned whole.

With *be used to*, learners produce the infinitive after *to*. *Solution:* a substitution drill putting nouns after *to* first (*used to the noise*), then gerunds.

**Pronunciation.** The contracted third conditional is barely recognisable to learners who have only met it written. *Solution:* dictate three natural-speed sentences before showing the transcript, then backchain. For /juːst/ against /juːzd/, minimal-pair drilling with both structures side by side.

**Reference:** Thornbury, S. (1999) *How to Teach Grammar*. Pearson.`,
  },
];

// --- Language Skills Related Task -----------------------------------------

const SKILLS = [
  {
    material: `The material is a two-page spread from *Roadmap B1+*, Unit 6, "Getting around". I am analysing the skills-focused part only: a 320-word online article titled "Four cities that got rid of their cars", and the three tasks built around it — a prediction task from the headline and photographs, a gist task (matching each city to a one-line summary), and a detail task (six true/false statements with a requirement to correct the false ones).

I have not included the grammar section that follows it, which focuses on comparatives, or the vocabulary panel. The text is authentic in origin, lightly graded: sentence length has been shortened and two low-frequency items glossed, but the organisation and the argument are the original's.`,
    subskills: `The three tasks target three distinct receptive sub-skills, in a deliberate order.

**Predicting from visual and textual clues.** Before any reading, learners look at the headline and four photographs and say which cities they think are described and what "got rid of" might mean here. This activates schemata — what learners already know about traffic, pedestrian zones, their own cities — and gives them a reason to read: to find out whether they were right. Nuttall (1996, p. 155) argues that prediction is what turns reading from decoding into a search, and that is precisely its function here.

**Reading for gist (skimming).** The matching task requires learners to read each section quickly enough to identify its main idea and no more. The four summaries are deliberately written with no overlapping vocabulary from the text, so the task cannot be completed by word-matching; learners have to understand the paragraph as a whole. The time limit — two minutes for 320 words — is what makes it a gist task rather than a slow, careful read.

**Reading for specific detail (scanning and careful reading).** The true/false task requires locating particular information and then evaluating it. The requirement to *correct* the false statements is what lifts this above a scanning task: a learner has to read the relevant sentence carefully enough to see exactly where the statement diverges from it.

There is also a small productive element in the final discussion question, but the skills focus of the material is receptive.`,
    staging: `**Lead-in.** The photographs and headline, in pairs, two minutes: "Which of these would you like to live in? Why?" The purpose is engagement and schema activation, not language. It also surfaces the topic vocabulary learners already have, which tells me what I do not need to pre-teach.

**Pre-teaching.** Three items only — *pedestrianise*, *congestion*, *to phase out* — chosen because they are load-bearing for the gist task and unguessable from context. Everything else is left, deliberately: a reading lesson in which every unknown word is pre-taught is not a reading lesson. Learners are told explicitly that they will not understand every word and do not need to.

**Gist task.** Learners read alone with a strict two-minute limit and match the four summaries. Pairs compare before whole-class feedback. The pair-check stage matters: it lets learners who finished confirm their reading, and it means nobody answers in open class having said nothing first.

**Detail task.** The six true/false statements, alone, with no time limit, then pair-check, then feedback where learners must say *where* in the text they found the answer. Asking for the evidence rather than the answer is what makes the feedback stage worth its time.

**Post-task.** A short discussion — "Would this work in your city?" — which moves the topic into production and gives the lesson a communicative close. This is where the reading becomes a reason to speak rather than an end in itself.`,
    problems: `These are problems with the *skill*, not the language.

**The text is longer than anything the group has read in one go.** Learners used to short coursebook paragraphs can panic at a full page, start decoding word by word and never finish the gist task. *Solution:* set the gist task before handing the text out, and enforce the two-minute limit strictly.

**Learners read every word because they believe that is what reading means.** This is a habit from an educational culture where reading aloud accurately was the measure. *Solution:* make the gist task genuinely impossible to complete slowly, then discuss the strategy explicitly in feedback: "How did you do it? Did you understand every word? Did you need to?"

**Background knowledge is uneven.** Learners from cities with no pedestrian zones may have nothing to predict from, while others have strong opinions. *Solution:* the lead-in is in pairs, deliberately mixed, and the photographs carry enough information that no prior knowledge is required.

**The true/false task can be done by matching words rather than reading.** If a statement repeats the text's wording, a learner can answer correctly without comprehension. *Solution:* the requirement to correct the false statements, and the feedback demand to name the line — both make word-matching insufficient.

**Early finishers.** Reading speeds vary more than speaking speeds. *Solution:* an extension question written on the board for anyone who finishes the detail task: "Find two things the writer does not tell us."

**References**
Grellet, F. (1981) *Developing Reading Skills*. CUP.
Harmer, J. (2015) *The Practice of English Language Teaching*. 5th edn. Pearson.
Nuttall, C. (1996) *Teaching Reading Skills in a Foreign Language*. 2nd edn. Heinemann.`,
  },
  {
    material: `The material is the listening sequence from *Speakout B1+*, Unit 8, "Money". I am analysing the skills-focused part: a 2 minute 40 second radio-style recording in which three speakers describe how they learned to manage money, and the tasks around it — a lead-in discussion, a gist task (matching each speaker to one of five statements, with one distractor), a detail task (six questions requiring specific figures and reasons), and a final speaking task.

I have excluded the functional-language panel on "talking about money" that follows, and the pronunciation box on numbers, although I refer to the latter below because it bears on the detail task.`,
    subskills: `**Listening for gist.** The matching task asks learners to identify each speaker's overall attitude — cautious, impulsive, or changed by an event — from a single hearing. The five statements include a distractor, which stops the task from being completed by elimination and forces a genuine judgement about all three speakers. Getting the gist of spoken text is a different sub-skill from reading gist: there is no going back, and the learner has to hold meaning while the speech continues.

**Listening for specific information.** The detail questions require figures, ages and reasons. Two of them are answered in one short phrase each, which the learner has to catch as it passes; this is scanning under time pressure, and is the sub-skill most learners find hardest.

**Coping with connected speech.** The recording is at natural speed and includes the features that make authentic listening hard — weak forms, elision across word boundaries ("wen(t) to"), and one speaker who self-corrects mid-sentence. Recognising these is a sub-skill in its own right, and the third hearing is designed to focus on it.

**Inferring attitude.** One speaker is being lightly ironic about their own past. Nothing states this; it is carried by intonation. Asking learners whether that speaker is proud or embarrassed is an inference task, and worth doing because it is what listening outside the classroom mostly consists of.`,
    staging: `**Lead-in.** Three questions on the board — "Did anyone teach you about money? Who? Was it good advice?" — discussed in pairs for three minutes. The purpose is engagement and schema activation, and it also surfaces whatever money vocabulary the group already holds.

**Pre-teaching.** Four items: *to budget*, *savings*, *in debt*, *to splash out*. Chosen because each is needed to complete the gist task and none is guessable from a single hearing. Nothing else is pre-taught — learners are told they will not catch everything.

**Gist listening.** One hearing, the matching task set *before* playing. Pairs compare, then feedback. If more than a third of the class is wrong, I play it again rather than giving the answers; a gist task that has failed is information about the task, not about the learners.

**Detail listening.** The questions are read first, so learners know what to listen for. One hearing, pair-check, then a second hearing for learners to confirm or fix their answers before feedback. Two hearings at this stage is not a concession — it is how detail listening works outside a classroom, where you ask someone to repeat.

**Focus on connected speech.** Learners see three short transcript lines and listen once more, marking what they hear elided or weakened. Brief — four minutes — but it is the stage that explains *why* the listening was hard.

**Post-task speaking.** "Which speaker are you most like?" in groups of three. This closes the lesson communicatively and reuses the pre-taught lexis in a genuinely personal context.`,
    problems: `**Learners expect to understand every word and treat not doing so as failure.** This is the single biggest barrier with authentic-speed listening, and it produces panic rather than strategy. *Solution:* say explicitly before the first play that nobody understands everything, set a gist task that is achievable without full comprehension, and in feedback ask how much they needed to understand to do it.

**One play is not enough, but too many plays destroy the gist task.** *Solution:* one hearing for gist, two for detail, one for the connected-speech focus — each with a different task, so repetition has a purpose rather than being a concession.

**Numbers and figures are disproportionately hard.** Two of the detail questions require them, and learners regularly confuse *thirteen* and *thirty*, or lose a figure entirely while processing the sentence around it. *Solution:* a ninety-second numbers dictation before the detail task as a micro-warmer, and acceptance of the figure written rather than said in feedback.

**The ironic speaker will be taken literally.** *Solution:* the inference question is asked after the detail work, not before, and I play that speaker's ten seconds again in isolation so intonation is the only thing left to attend to.

**The recording is faster than the group's own speech, so confidence drops.** *Solution:* end on the speaking task, which returns control to the learners, and keep the connected-speech stage framed as an explanation rather than a correction.

**References**
Field, J. (2008) *Listening in the Language Classroom*. CUP.
Harmer, J. (2015) *The Practice of English Language Teaching*. 5th edn. Pearson.
Underhill, A. (2005) *Sound Foundations*. 2nd edn. Macmillan.`,
  },
];

// --- Lessons from the Classroom -------------------------------------------

const LFC = [
  {
    strengths: `**Rapport and the atmosphere in the room.** From TP4 onwards my tutor's feedback has used the word "warm" three times, and the summary for TP6 said learners "clearly enjoy being taught by you and take risks in front of you". I notice it in a concrete way: learners volunteer answers in my lessons who do not volunteer in others, and I know that because I have watched them not do it. What I do that produces it is small and repeatable — I arrive early and talk to whoever is there, I use names constantly, and I do not fill silences.

**Clear, staged instructions.** This was an action point after TP2, where I gave a three-part instruction in one breath and the class did the wrong task. Since TP4 I have written instructions out in full in the procedure column and demonstrated rather than explained. TP6's feedback recorded "instructions clear and checked; the ICQ on the second task was exactly the right one".

**Boarding.** My tutor noted after TP5 that my whiteboard was "organised, legible, and — unusually — still useful at the end of the lesson". I plan the board layout in advance now, with a column for target language and a column for emergent language, which was a direct borrowing from an experienced teacher I observed.`,
    action_points: `**Teacher talking time, especially during instructions and feedback.** This has appeared in three consecutive feedback sheets. TP6's said "the task was clear after your first sentence; the next four were for you, not them". I paraphrase myself when I am nervous, which is exactly when learners need me to stop.

**Monitoring with a purpose.** My tutor's phrase after TP5 was "you circulate, but you do not collect". I move around, I help pairs who ask, and then I arrive at the feedback stage with nothing written down, so my delayed error correction is general rather than specific.

**Timing of the final stage.** In four of my six lessons the freer practice stage was cut short or dropped. The cause is upstream: my clarification stages consistently overrun by five to eight minutes because I keep adding examples. The lesson that suffers is always the last one, which is the one where learners actually produce language.`,
    observation: `**For teacher talking time**, I watched an experienced teacher set up an information-gap task in eleven words and a demonstration, and then physically walk to the back of the room. The walking was the part I had not thought of: she removed herself as a focus, so there was nobody to address questions to. I tried it in TP6 and the pairs started without looking at me for the first time.

**For monitoring,** in a peer observation of a colleague's TP5 I noticed she carried a folded piece of paper and wrote on it constantly while circulating — not a formal sheet, just a line per pair. Her delayed correction stage afterwards used four real sentences learners had produced, with names withheld, and the class recognised their own language. That is the mechanism I was missing: the notes are not for her, they are the content of the next stage.

**For timing,** I watched a tutor's demonstration lesson where she said out loud, to the class, "we have eight minutes for this, so two minutes each and then we stop". Announcing the time did two things at once: it committed her to it in front of witnesses, and it gave the learners the pace. I have started doing this and have dropped a final stage once since, rather than four times in six.`,
    post_course: `**Getting my teacher talking time down deliberately, with evidence.** I intend to record myself teaching once a month for the first six months and count the ratio, rather than relying on how it felt. Feeling is what got me to three consecutive feedback sheets saying the same thing.

**Building a real repertoire for clarifying language.** I lean on CCQs and timelines because they are what I was taught first. I want to be competent with substitution tables, cline work and eliciting from context, and the way to do that is to plan one unfamiliar technique into every week's lessons rather than waiting to feel ready.

**Working towards teaching exam classes, and eventually examining.** The session on exam classes in the last week made clear that a CELTA plus three years is enough to apply as a speaking examiner. That is a concrete two-to-three-year goal, and in the meantime I intend to teach at least one B2 First group so that the experience is real rather than theoretical. I will look at the Cambridge Delta Module One in that timeframe as well — not immediately, because I want a year of ordinary teaching first.`,
  },
  {
    strengths: `**Lesson shape.** My tutor's feedback for TP5 said the lesson "had a clear arc — the learners could have told you what they were doing and why at any point". I plan backwards from what I want learners to produce, which I started doing after the Lesson Framework session, and it has removed the stage that used to appear in my plans for no reason other than filling time.

**Correction, particularly delayed correction.** After TP3 I was correcting everything on the spot and stopping fluency stages dead. I now carry a notebook while monitoring, and TP6's feedback recorded "an excellent delayed correction slot: five real sentences, learners self-corrected four of them". Getting the learners to do the correcting was the change, not the noticing.

**Materials.** I have adapted rather than used coursebook material in four of six lessons — cutting a reading text down, rewriting a task so it had an information gap, replacing photographs. TP4's feedback said the adapted handout was "the reason the task worked". I enjoy this part and it shows.`,
    action_points: `**Concept checking.** My CCQs are often questions about the words rather than the meaning. "Is 'used to' past or present?" tests terminology, not concept. This has been noted twice, most directly after TP4: "the CCQs did not check anything a learner could get wrong."

**Nomination and who gets to speak.** My tutor's note after TP6 was that four learners produced most of the open-class language in a group of eight, and that I had nominated by eye contact rather than by name. The quieter half of the room has less practice because of a habit I was not aware of.

**Pace in the early stages.** My lead-ins run long — TP5's lead-in was planned for four minutes and took nine — because I follow interesting tangents. It is the most enjoyable part of my teaching and it costs the lesson its practice stage.`,
    observation: `**For concept checking,** I watched an experienced teacher clarify "he must have missed the train" using nothing but a situation and three questions: "Do I know? Am I sure? Is it before or now?" None of them used a grammatical term, and every one of them would catch a learner who had the wrong concept. I wrote them down verbatim and used the same shape in TP6.

**For nomination,** in a peer observation I watched a colleague put eight lolly sticks with names on them in a cup and draw them. It looked gimmicky and it worked: the quiet learners were nominated as often as the loud ones, and nobody could predict it, so everyone prepared an answer. The underlying principle — remove your own bias from the selection — is what I took, and I now go round the register rather than round the room.

**For pace,** I observed a tutor use a visible timer projected on the screen for every stage of a lesson. The class self-regulated: two pairs finished and said so rather than drifting. I have begun writing the finishing time of each stage on the corner of the board, which is less intrusive and has cut my lead-in overruns to two or three minutes.`,
    post_course: `**Concept checking as a discipline, not an afterthought.** I will write CCQs with their expected answers into every plan for at least six months, in full, rather than improvising them. Writing the answer is the part that exposes a bad question.

**Teaching a level I have not taught.** My six hours were all at pre-intermediate and above. Working with genuine beginners is a different skill and I would rather learn it in my first year than avoid it — I intend to ask for at least one A1 group.

**Reading, with structure.** I have a habit of collecting techniques and no habit of reading the reasoning behind them. I intend to work through Scrivener's *Learning Teaching* properly, a chapter a fortnight, and to join the local teachers' association so that I am accountable to somebody for having done it. Longer term — two or three years — the Delta, once I have enough teaching behind me for it to be worth the money.`,
  },
];

// --- The Plagiarism Reflection ---------------------------------------------

const REFLECTION = {
  what_happened: `I submitted my Language Related Tasks assignment at 1:40am on the day it was due. Two paragraphs of the analysis of "used to" — the section on form, and part of the anticipated problems — were taken almost word for word from an online grammar reference, with a few words changed. I did not cite it.

What I was doing, in order: I had left the assignment to the last two days because of TP preparation. I had the meaning section done and I understood the structure well enough to teach it. When I came to write the form section at around midnight, I could not make my own explanation as clear as the one I was reading, and I was tired enough to tell myself that the wording did not matter because the understanding was mine. I copied it into my draft intending to rewrite it, and then I did not rewrite it. I submitted at 1:40 without rereading the whole thing.

I am not disputing the finding. I knew when I pasted it that I would not be able to say where the words came from if anyone asked, and that is the test I should have applied at the time rather than three days later.`,
  which_rule: `The centre's malpractice policy, which I accepted at enrolment, defines plagiarism as "presenting the words, ideas or work of another person as your own, whether or not this is intentional, including close paraphrase without acknowledgement". Both paragraphs fall under this: the words are not mine and there is no acknowledgement. The policy's inclusion of "whether or not this is intentional" applies directly to me, because my intention was to rewrite the passage later, and the policy is clear that the intention is not what is assessed.

The candidate agreement I signed states that all written work submitted is my own and that sources will be referenced in the body of the assignment. Referencing is not only an honesty requirement here; it is one of the assessment criteria for this assignment — "shows evidence of having accessed appropriate reference materials, i.e. gives the name of at least one book used to research the area". Had I cited the source properly, the same reading would have counted in my favour rather than against me. That is the part I find hardest to accept about my own decision.

The Cambridge guidance on the use of AI and other sources, in the resource hub, says the candidate must be able to account for the origin of everything they submit. I could not.`,
  why_it_matters: `The obvious answer is that it is unfair to other candidates, and it is. But the reason that matters here is narrower and it is about teaching.

A teacher's authority in a classroom rests on the learners believing that what the teacher tells them is the teacher's own understanding. If I clarify "used to" using an explanation I have not understood well enough to phrase myself, the first learner question that goes sideways will expose it — not because I am dishonest in that moment, but because there is nothing underneath the words. Learners can tell. I have watched trainees, including myself, get caught out by exactly this in TP feedback.

There is also the matter of what I would be modelling. I will at some point teach learners to write, and to use sources, and to reference them. Some of those learners will be sitting exams where the penalty for doing what I did is disqualification and a three-year ban on re-entry.

And for a centre: an assessor reviewing this course sees the work of everyone on it. A centre that knowingly submits plagiarised work to Cambridge risks its approval, which affects every candidate on every future course here, none of whom had anything to do with my decision.`,
  going_forward: `**Noting sources as I read, not afterwards.** The mechanism that failed was not honesty, it was that by midnight I could no longer tell which sentences in my notes were mine. From now on anything copied into my notes goes in quotation marks with the source and page on the same line, at the moment I copy it. If it is not in quotation marks it is mine. That rule costs nothing and would have prevented this entirely.

**Referencing as I write, never as a final pass.** I will put the citation in as I use the source, in the body, in the (Author, Year, p. ##) format the brief asks for. A bibliography assembled at the end is where things get lost.

**AI tools, specifically.** I will use them for what I would use a dictionary or a thesaurus for — checking my own grammar, or asking what a term means — and not for producing text that goes into an assignment. Anything an AI tool contributes will be declared on the submission with the conversation link, which the form asks for anyway. If I would not be comfortable showing the conversation, that is the signal not to use it.

**At 1am with seven hours to go and nothing written.** This is the situation this is actually about. What I will do is submit what I have, incomplete and honest, and tell the tutor why. An incomplete assignment is a resubmission; a plagiarised one is this. I have also changed how I plan the week — assignment work now goes in the calendar three days before the deadline, in the same way TP preparation does, because the reason I was writing at midnight was that I had treated it as the thing that fits in the gaps.`,
};

const LRT_SHAPES = [LRT[0], LRT[1]];

/** The text for one submission, keyed by section, or null if we have none. */
export function submissionFor(assignmentType, sectionKeys, candidateIndex) {
  const variant = candidateIndex % 2;
  const learner = LEARNERS[candidateIndex % LEARNERS.length];

  let source = null;
  if (assignmentType === "Focus on Learner") {
    source = sectionKeys.includes("tp_group") ? folDefault(learner, variant) : folElmswood(learner, variant);
  } else if (assignmentType === "LRT") {
    source = LRT_SHAPES[variant];
  } else if (assignmentType === "Skills") {
    source = SKILLS[variant];
  } else if (assignmentType === "LfC") {
    source = LFC[variant];
  } else if (assignmentType === "Plagiarism Reflection") {
    source = REFLECTION;
  }
  if (!source) return null;

  const out = {};
  for (const key of sectionKeys) if (source[key]) out[key] = source[key];
  return Object.keys(out).length > 0 ? out : null;
}

export function countWords(text) {
  const cleaned = String(text ?? "").replace(/[*_#]/g, " ").trim();
  return cleaned.length === 0 ? 0 : cleaned.split(/\s+/).length;
}
