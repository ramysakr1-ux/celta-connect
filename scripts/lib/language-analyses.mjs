// Real language analysis sheets for the seeded lesson plans.
//
// Ramy, 13 Sep 2026: "write analyses onto the rest of the language plans."
// Before this, two analyses existed on the whole demo -- eleven candidates
// through eight teaching practices each, and not one language sheet, on a
// qualification where analysing language is criterion 4i and a whole section
// of CELTA 5. A tutor opening the analysis tab always found it empty, and the
// assessor's pack showed a course where nobody had analysed anything.
//
// Written to be CORRECT, not merely plausible: meaning stated as a learner
// would need it, concept questions with their answers, form described the way
// a tutor would board it, phonemic transcription in IPA, and problems that are
// the ones learners actually have. A wrong analysis sitting in a demo is worse
// than no analysis, because someone will copy it.
//
// Sources named in each block are the references a CELTA candidate is actually
// pointed at: Swan's Practical English Usage, the Cambridge Learner's
// Dictionary, Parrott's Grammar for English Language Teachers.
//
// Skills lessons (read for gist, listen for detail, speak about...) get no
// sheet, which is correct -- the analysis sheet is for a language aim.

const pairs = (...xs) => xs.map(([problem, solution]) => ({ problem, solution }));

/** One grammar/function block, with the shape ANALYSIS_SHEETS expects. */
function block({ item, marker, meaning, source, clarify, meaningProblems, form, formProblems, phonetic, pron, pronProblems, register }) {
  return {
    item,
    ...(register ? { register } : {}),
    marker,
    meaning,
    source,
    clarify,
    meaning_problems: pairs(...(meaningProblems ?? [])),
    form,
    form_problems: pairs(...(formProblems ?? [])),
    phonetic: phonetic ?? "",
    pronunciation_features: pron ?? "",
    pronunciation_problems: pairs(...(pronProblems ?? [])),
  };
}

// ---------------------------------------------------------------- grammar

const GRAMMAR = {
  "present simple for daily routines": {
    context: "What people in the class do on an ordinary weekday.",
    blocks: [
      block({
        item: "Present simple for daily routines",
        marker: "I start work at nine.\nShe starts work at nine.\nHe doesn't work on Fridays.",
        meaning:
          "Something that happens regularly, again and again. Not now — now is the present continuous. The time it happens is usually fixed or habitual.",
        source: "Swan, Practical English Usage (4th ed.) §57; Parrott, Grammar for English Language Teachers, ch. 8",
        clarify:
          "Timeline on the board with crosses along it, marked Monday to Friday, and 'now' somewhere in the middle.\nCCQs — Does she do this once? (No, many times.) Is she doing it right now? (We don't know — it doesn't matter.) Is it a habit? (Yes.)",
        meaningProblems: [
          [
            "Learners use the present continuous for routines: 'I am starting work at nine every day.'",
            "Put the two timelines side by side and CCQ the difference: repeated cross-marks against one arrow at 'now'.",
          ],
          [
            "Learners think the present simple means 'right now' because of the name.",
            "Avoid discussing the name; work from the timeline and the frequency adverbs instead.",
          ],
        ],
        form: "Subject + base verb. Third person singular adds -s: he/she/it starts.\nNegative: don't / doesn't + base verb — the -s moves to the auxiliary, so 'He doesn't work', never 'He doesn't works'.\nQuestion: Do / Does + subject + base verb?",
        formProblems: [
          ["Omitting the third-person -s: 'She start at nine.'", "Board the paradigm with the -s in a different colour and drill the third person specifically."],
          ["Doubling it up: 'He doesn't works.'", "Show that the -s lives on ONE word in the sentence; cross out the second."],
        ],
        phonetic: "/stɑːts/ · /wɜːks/ · /ˈdʌznt/",
        pron: "The third-person -s is /s/ after an unvoiced sound (starts /s/), /z/ after a voiced one (lives /z/), and /ɪz/ after a sibilant (watches /ɪz/). 'Does he' links as /dəzi/ in connected speech.",
        pronProblems: [
          ["Learners pronounce every -s as /s/.", "Drill the three endings in sets, sorting example verbs into three columns."],
          ["Full form /duːz/ in questions, which sounds heavy.", "Drill the weak form inside the whole question."],
        ],
      }),
    ],
  },

  "present perfect for experience": {
    context: "Things people in the class have and haven't done in their lives.",
    blocks: [
      block({
        item: "Present perfect for experience (indefinite past)",
        marker: "I've been to Japan.\nHave you ever eaten octopus?\nShe's never flown business class.",
        meaning:
          "It happened at some time in the speaker's life up to now. WHEN it happened is not said and does not matter — if it did, we would use the past simple. The experience still counts because the life is still going on.",
        source: "Swan, Practical English Usage (4th ed.) §62; Parrott, ch. 10",
        clarify:
          "Timeline: a line from birth to 'now', with a question mark floating above it rather than a fixed cross.\nCCQs — Do we know when? (No.) Is it finished? (Yes.) Is the person still alive? (Yes.) Can it happen again? (Yes.)",
        meaningProblems: [
          [
            "Learners add a finished time: 'I've been to Japan last year.'",
            "Show the two timelines together — a cross at a named point takes the past simple. Give a quick transformation drill from one to the other.",
          ],
          [
            "L1s with a present-perfect-shaped form that means something else lead to over-use for recent single events.",
            "Keep every practice item unambiguous about time, and CCQ 'do we know when?' each time.",
          ],
        ],
        form: "have / has + past participle.\nNegative: haven't / hasn't + past participle.\nQuestion: Have / Has + subject + (ever) + past participle?\n'ever' sits between the subject and the participle in questions; 'never' replaces the negative auxiliary.",
        formProblems: [
          ["Past simple form instead of the participle: 'I've went.'", "Board the three columns (go / went / gone) and drill the third."],
          ["'I haven't never been.'", "Point out that 'never' is already negative, so the auxiliary is positive."],
        ],
        phonetic: "/aɪv biːn/ · /həv juː ˈevə/ · /ʃiːz ˈnevə/",
        pron: "'have' contracts to /v/ or /əv/ and is almost never full in speech. 'Have you ever' runs together as /həvjuːˈevə/, with the stress on 'ever'.",
        pronProblems: [
          ["Full /hæv/ in every sentence, which makes the form hard to hear and to say.", "Drill the contracted forms from the start; write I've, you've, she's on the board, not the full forms."],
          ["'been' /biːn/ confused with 'bin' /bɪn/.", "Minimal pair drill."],
        ],
      }),
    ],
  },

  "there is / there are": {
    context: "What there is in the town where the class lives.",
    blocks: [
      block({
        item: "there is / there are, to say something exists",
        marker: "There's a market near the station.\nThere are two cinemas.\nThere isn't a swimming pool.",
        meaning:
          "Used to say that something exists, or does not, usually somewhere. 'There' here is not a place — it is not pointing at anything. The real subject comes after the verb.",
        source: "Swan, Practical English Usage (4th ed.) §588",
        clarify:
          "A simple map of the town on the board; point at it while saying the marker sentences.\nCCQs — Am I pointing at a place when I say 'there'? (No.) Does the market exist? (Yes.) How many cinemas? (Two.)",
        meaningProblems: [
          ["Learners read 'there' as the place adverb and look for it on the map.", "Contrast 'There's a market there' in one sentence so the two uses are visibly different."],
          ["L1 uses a 'have' structure: 'The town has a market.'", "Accept it as correct English but keep the target form for the practice stage."],
        ],
        form: "There + is / are + noun phrase (+ place).\nThe verb agrees with what FOLLOWS it, not with 'there': there is a market / there are two cinemas.\nNegative: there isn't / there aren't.\nQuestion: Is there…? / Are there…?",
        formProblems: [
          ["'There is two cinemas.'", "Board the rule as an arrow from the verb to the noun after it, and drill singular and plural in pairs."],
          ["'It has a market' or 'Have a market'.", "Contrast with the L1-shaped sentence explicitly."],
        ],
        phonetic: "/ðeəz/ · /ðərə/ · /ˈðerɪznt/",
        pron: "'There is' contracts to 'there's' /ðeəz/. 'There are' weakens to /ðərə/ and the 'are' almost disappears — learners who say /ðeə ɑː/ sound unnatural and often cannot hear it in listening.",
        pronProblems: [
          ["Full /ðeə ɑː/.", "Drill /ðərə/ in a whole sentence, then play it back in a short recording so they hear it is the same thing."],
          ["/ð/ produced as /d/ or /z/.", "Show the tongue position; minimal pairs with 'day' and 'they'."],
        ],
      }),
    ],
  },

  "past simple (regular verbs)": {
    context: "What the class did last weekend.",
    blocks: [
      block({
        item: "Past simple, regular verbs, for finished actions",
        marker: "I watched a film on Saturday.\nWe didn't cook — we ordered a pizza.\nDid you work last weekend?",
        meaning:
          "Finished, at a time in the past that is known or stated. The time is over and so is the action. It has no connection to now.",
        source: "Swan, Practical English Usage (4th ed.) §59",
        clarify:
          "Timeline with a cross at 'Saturday', clearly before 'now', and a box drawn round the finished time.\nCCQs — Is it finished? (Yes.) Do we know when? (Yes, Saturday.) Is he watching now? (No.)",
        meaningProblems: [
          ["Learners use the present perfect for a stated past time.", "CCQ 'do we know when?' and contrast the two on one timeline."],
          ["Learners drop the past reference and leave the listener guessing.", "Build the time expression into every controlled practice prompt."],
        ],
        form: "Verb + -ed. Spelling: -e takes only -d (liked); consonant + y becomes -ied (studied); a short stressed vowel doubles the final consonant (stopped).\nNegative and question use did / didn't + BASE form: 'I didn't watch', never 'I didn't watched'.",
        formProblems: [
          ["'I didn't watched.'", "Board 'did' as carrying the past, so the main verb goes back to base. Cross out the -ed in the example."],
          ["Spelling: 'studyed', 'stoped'.", "Sort a set of verbs into the three spelling columns as a task before the writing stage."],
        ],
        phonetic: "/wɒtʃt/ · /ˈɔːdəd/ · /wɜːkt/",
        pron: "-ed has three pronunciations: /t/ after an unvoiced sound (watched), /d/ after a voiced one (played), /ɪd/ only after /t/ or /d/ (ordered, wanted). Learners who give every -ed an extra syllable are hard to follow.",
        pronProblems: [
          ["/ˈwɒtʃɪd/ for 'watched'.", "Three-column sorting drill by ending sound, not by spelling."],
          ["'didn't' as two clear syllables.", "Drill /ˈdɪdnt/ with the elided vowel."],
        ],
      }),
    ],
  },

  "used to for past habits": {
    context: "How life was different when the class were children.",
    blocks: [
      block({
        item: "used to + infinitive, for past habits and past states",
        marker: "I used to walk to school.\nShe didn't use to like coffee.\nDid you use to have a bike?",
        meaning:
          "Something that happened repeatedly in the past, or a state that lasted, and is NOT true now. The contrast with now is the whole point of choosing it.",
        source: "Swan, Practical English Usage (4th ed.) §605; Parrott, ch. 9",
        clarify:
          "Timeline: a row of crosses in the past, then a clear gap up to 'now', with a cross through the 'now' end.\nCCQs — Did it happen many times? (Yes.) Does it happen now? (No.) Is it past? (Yes.) Do we know exactly when? (No.)",
        meaningProblems: [
          ["Learners use it for a single past event: 'I used to go to Paris last year.'", "CCQ 'once or many times?' and give a sorting task of single events versus habits."],
          ["Learners think it means the present 'be used to'.", "Keep the two apart in this lesson; board only the past form and say plainly that the other one is a different structure."],
        ],
        form: "used to + BARE infinitive.\nNegative and question use did, and the 'd' disappears: didn't USE to, Did you USE to…?\nThere is no present form — 'I use to walk' does not exist.",
        formProblems: [
          ["'I didn't used to.'", "Board both spellings and cross out the -d after 'did', the same rule as the past simple."],
          ["Inventing a present: 'I use to walk to work now.'", "State that the structure is past-only and give a correction-spotting task."],
        ],
        phonetic: "/ˈjuːst tə/ → /ˈjuːstə/",
        pron: "'used to' is /ˈjuːstə/ — the /d/ is not pronounced and 'to' weakens to schwa. Note the /s/, not /z/: this is not the verb 'used' /juːzd/.",
        pronProblems: [
          ["/ˈjuːzd tuː/ with a /z/ and a full 'to'.", "Contrast with 'I used a knife' /juːzd/ and drill the difference."],
          ["Three clear syllables.", "Drill the two-syllable /ˈjuːstə/ inside a whole sentence."],
        ],
      }),
    ],
  },

  "past continuous": {
    context: "What people were doing when something interrupted them.",
    blocks: [
      block({
        item: "Past continuous for an action in progress in the past",
        marker: "I was cooking when the phone rang.\nThey weren't listening.\nWhat were you doing at eight?",
        meaning:
          "An action that was already going on at a moment in the past. It started before that moment and often continues after it. Frequently the background to a shorter, finished action in the past simple.",
        source: "Swan, Practical English Usage (4th ed.) §60; Parrott, ch. 9",
        clarify:
          "Timeline: a wavy line across the past for the cooking, a vertical arrow cutting through it for the phone call.\nCCQs — Which started first? (The cooking.) Was the cooking finished when the phone rang? (No.) Is the phone call long or short? (Short.)",
        meaningProblems: [
          ["Both verbs put in the past simple, which loses the interruption.", "Board both versions and ask which one tells you the cooking was already happening."],
          ["Used with state verbs: 'I was knowing.'", "Give the common state verbs as a short list and practise them in the simple."],
        ],
        form: "was / were + verb-ing.\nNegative: wasn't / weren't + -ing.\nQuestion: Was / Were + subject + -ing?\n'when' introduces the past simple clause, 'while' the continuous one.",
        formProblems: [
          ["Wrong auxiliary for the person: 'They was cooking.'", "Board was/were against the subject pronouns and drill."],
          ["'when' and 'while' swapped.", "Give a gap-fill where only one fits, and check with the timeline."],
        ],
        phonetic: "/wəz ˈkʊkɪŋ/ · /wə juː/",
        pron: "'was' and 'were' are weak — /wəz/ and /wə/ — everywhere except in short answers. The -ing ending is /ŋ/, not /n/ or /ŋɡ/.",
        pronProblems: [
          ["Full /wɒz/ and /wɜː/ throughout.", "Drill the weak forms in sentences, then the strong form in a short answer so the contrast is clear."],
          ["-ing as /ɪn/.", "Model the velar nasal and drill minimal pairs: thin / thing."],
        ],
      }),
    ],
  },

  "countable and uncountable nouns": {
    context: "What is in the fridge at home.",
    blocks: [
      block({
        item: "Countable and uncountable nouns, with some / any / a",
        marker: "There are some apples.\nThere's some milk.\nIs there any bread?\nWe haven't got any eggs.",
        meaning:
          "Countable nouns are things we can count one by one and can make plural. Uncountable nouns are treated as a mass and have no plural: milk, bread, rice, water. Whether a noun is one or the other is a fact about the word, not about the world, so it has to be learned with the word.",
        source: "Swan, Practical English Usage (4th ed.) §148; Cambridge Learner's Dictionary",
        clarify:
          "Two columns on the board with pictures sorted into them. Elicit the sort rather than giving it.\nCCQs — Can I say 'two milks' in the shop? (No.) Can I say 'two apples'? (Yes.) Does 'bread' have a plural? (No.)",
        meaningProblems: [
          ["Learners apply their L1's categories: 'informations', 'advices', 'a bread'.", "Teach the awkward ones explicitly as a short list, and record them in the notebook with the countable/uncountable label."],
          ["Learners assume anything they can see one of must be countable.", "Use the shop test — 'can you ask for two?' — rather than reasoning about the object."],
        ],
        form: "Countable: a / an with singular, some / any with plural.\nUncountable: no article, some / any, and a singular verb.\n'some' in positive sentences and in offers or requests; 'any' in negatives and most questions.\nQuantity for uncountables uses a partitive: a slice of bread, a carton of milk.",
        formProblems: [
          ["'There are some milk.'", "Board the agreement arrow from the verb to the noun and drill both types in pairs."],
          ["'some' in a negative: 'We haven't got some eggs.'", "Give a sorting task of some/any sentences and elicit the rule."],
        ],
        phonetic: "/səm/ · /ˈeni/",
        pron: "'some' is weak, /səm/, in ordinary statements and strong, /sʌm/, only when it is contrastive. 'any' is /ˈeni/ — not /ˈænɪ/.",
        pronProblems: [
          ["/sʌm/ everywhere, which sounds emphatic.", "Drill the weak form in whole sentences; show the strong form only in a contrastive example."],
          ["Spelling-led /ˈænɪ/ for 'any'.", "Model and drill; write the transcription beside the word."],
        ],
      }),
    ],
  },

  "the second conditional": {
    context: "What people would do with an unexpected free day.",
    blocks: [
      block({
        item: "Second conditional, for an unreal or unlikely present or future",
        marker: "If I had a free day, I'd go to the coast.\nWhat would you do if you won the lottery?",
        meaning:
          "Imagining something that is not true now, or is very unlikely. The past form is not about past time — it marks distance from reality. The speaker is not expecting it to happen.",
        source: "Swan, Practical English Usage (4th ed.) §241; Parrott, ch. 14",
        clarify:
          "Two labelled boxes on the board, REAL and NOT REAL, and put the marker sentence in the second.\nCCQs — Do I have a free day? (No.) Am I going to the coast? (No.) Is it possible? (Not really.) Am I talking about the past? (No.)",
        meaningProblems: [
          ["Learners read the past form as past time.", "Put a first conditional beside it and ask which one the speaker thinks will happen."],
          ["Learners use it for likely future plans where the first conditional belongs.", "Sorting task: likely or unlikely, then choose the form."],
        ],
        form: "If + past simple, + would / 'd + bare infinitive.\nThe clauses can swap, and the comma disappears when the 'if' clause comes second.\n'were' is used for all persons in careful English: 'If I were you'.",
        formProblems: [
          ["'If I would have a free day.'", "Board the pattern as two halves and mark which half takes 'would'."],
          ["'I'd would go.'", "Show that 'd IS would; expand the contraction on the board."],
        ],
        phonetic: "/aɪd ɡəʊ/ · /wʊd juː/ → /ˈwʊdʒuː/",
        pron: "'would' contracts to 'd after a pronoun and is easy to miss. 'would you' assimilates to /ˈwʊdʒuː/.",
        pronProblems: [
          ["Full 'would' in every clause.", "Drill the contraction first and write 'I'd' on the board rather than 'I would'."],
          ["'d confused with 'had'.", "Show that the verb after it decides which: bare infinitive means would."],
        ],
      }),
    ],
  },

  "defining relative clauses": {
    context: "Describing people by what they do.",
    blocks: [
      block({
        item: "Defining relative clauses with who, which, that",
        marker: "She's the woman who lives upstairs.\nThat's the café which does the good coffee.",
        meaning:
          "The clause says WHICH one — it identifies the person or thing, and the sentence does not make sense without it. No commas, because it is not extra information.",
        source: "Swan, Practical English Usage (4th ed.) §494; Parrott, ch. 19",
        clarify:
          "Show two similar pictures and ask which one is meant; the clause is what settles it.\nCCQs — Do I know which woman without the second part? (No.) Is the second part extra, or necessary? (Necessary.)",
        meaningProblems: [
          ["Learners add commas by analogy with L1 punctuation, turning it into a non-defining clause.", "Contrast one pair of sentences with and without commas and ask how many sisters the speaker has."],
          ["Learners think 'who' and 'which' are interchangeable.", "Sorting task: people or things."],
        ],
        form: "Noun + who (people) / which (things) / that (either) + verb.\nThe relative pronoun REPLACES the subject, so it is not repeated: 'the woman who lives upstairs', never 'the woman who she lives upstairs'.\n'that' is common in speech; 'which' is more formal.",
        formProblems: [
          ["Subject repeated: 'the man who he works here.'", "Cross out the pronoun on the board and drill the corrected sentence."],
          ["'what' used as a relative pronoun.", "Correction-spotting task including this as one of the items."],
        ],
        phonetic: "/huː/ · /wɪtʃ/ · /ðæt/ → /ðət/",
        pron: "'that' as a relative pronoun is weak, /ðət/, unlike the demonstrative 'that' /ðæt/. The clause is normally said without a pause before it, which is what the missing comma sounds like.",
        pronProblems: [
          ["A pause before the clause, which makes it sound non-defining.", "Drill the whole sentence as one unbroken group."],
          ["/w/ dropped or added in 'which'.", "Model and drill; contrast with 'witch' only if the class finds it useful."],
        ],
      }),
    ],
  },

  "comparative adjectives": {
    context: "Comparing two places the class knows.",
    blocks: [
      block({
        item: "Comparative adjectives with than",
        marker: "The train is faster than the bus.\nThis café is more expensive than that one.",
        meaning:
          "Comparing two things on one quality, and saying that one has more of it. Not the most — that is the superlative, and needs three or more.",
        source: "Swan, Practical English Usage (4th ed.) §137",
        clarify:
          "Two pictures side by side on the board with a scale drawn between them.\nCCQs — How many things am I comparing? (Two.) Which one is faster? (The train.) Am I saying the train is the fastest of all? (No.)",
        meaningProblems: [
          ["Comparative used where the superlative belongs.", "Show two pictures and then five, and ask which sentence fits each."],
          ["The second thing left out, so the comparison hangs.", "Build 'than…' into every controlled practice prompt."],
        ],
        form: "One syllable: + -er (faster). Ending in -y: -ier (easier). Two syllables or more: more + adjective (more expensive).\nIrregulars: good → better, bad → worse, far → further.\n'than' introduces the second thing.",
        formProblems: [
          ["Doubling it: 'more faster'.", "Board the two routes as a choice and cross out the combination."],
          ["'more good'.", "Teach the three irregulars explicitly and drill them separately."],
        ],
        phonetic: "/ˈfɑːstə ðən/ · /mɔːr ɪkˈspensɪv/",
        pron: "'than' is almost always weak, /ðən/, and runs onto the word before it. The -er ending is schwa, /ə/, not a full vowel.",
        pronProblems: [
          ["Strong /ðæn/, which sounds emphatic.", "Drill 'faster than the bus' as one group."],
          ["-er pronounced /ɜː/.", "Model the schwa and drill several comparatives in a row."],
        ],
      }),
    ],
  },

  "should": {
    context: "A friend is moving to a new city next month and asks for advice about the first week.",
    blocks: [
      block({
        item: "should + bare infinitive, for giving advice",
        marker: "You should open a bank account before you arrive.\nYou shouldn't sign a contract you haven't read.",
        meaning:
          "The speaker thinks this is a good idea for the listener. It is advice, not obligation — the listener is free to ignore it. Weaker than 'must' or 'have to', which carry obligation from a rule or from the speaker's authority.",
        source: "Swan, Practical English Usage (4th ed.) §498; Cambridge Dictionary",
        clarify:
          "Situation on the board: a friend is moving here next month and asks what to do first. Elicit the marker sentence.\nCCQs — Is this a rule? (No.) Do I think it's a good idea? (Yes.) Does my friend have to do it? (No.) Am I their boss? (No.)",
        meaningProblems: [
          ["Learners hear advice as obligation and confuse 'should' with 'must'.", "Contrast on the board with a rule they already know — 'You must have a visa' beside 'You should book early' — and CCQ each one."],
          ["Learners reach for a conditional and over-use 'if I were you'.", "Accept it as a genuine alternative, then steer the controlled practice back to the target form."],
        ],
        form: "should + bare infinitive. No third-person 's': 'He should call', not 'He shoulds call'.\nNegative: shouldn't + bare infinitive.\nQuestion: Should + subject + bare infinitive?\nThe form is the same for every person.",
        formProblems: [
          ["Adding 'to': 'You should to open a bank account.'", "Write 'to' on the board and cross it out, then drill the correct form."],
          ["Third-person 's': 'She shoulds ask.'", "Board the paradigm for all six persons so the invariable form is visible at once."],
        ],
        phonetic: "/ʃʊd/  weak /ʃəd/  ·  /ˈʃʊdnt/",
        pron: "'should' weakens to /ʃəd/ in connected speech and the 'l' is silent. In 'should open' the /d/ links onto the vowel: /ʃʊd‿ˈəʊpən/.",
        pronProblems: [
          ["Learners pronounce the 'l' in 'should'.", "Model it, show the transcription beside the spelling, then drill."],
          ["Full form in every sentence, which makes the advice sound heavy.", "Drill the weak form inside the whole sentence rather than the word on its own."],
        ],
      }),
      block({
        item: "ought to + infinitive, for giving advice",
        marker: "You ought to register with a doctor in the first week.",
        meaning:
          "The same advice as 'should', a little more formal and less common in speech. Often chosen when the advice comes from what is generally right or expected rather than from the speaker's own opinion.",
        source: "Swan, Practical English Usage (4th ed.) §499",
        clarify:
          "Put it on the board beside the 'should' marker sentence.\nCCQs — Is the meaning very different? (No.) Which would you say to a friend? (Either — 'should' is more common.)",
        meaningProblems: [
          ["Learners hunt for a difference in meaning that is not really there, and hesitate.", "Say plainly that the two are close, and that 'should' is the safer everyday choice."],
        ],
        form: "ought TO + infinitive — the 'to' is part of this structure, unlike 'should'.\n'oughtn't to' is rare; 'shouldn't' is normally used instead. Questions with 'ought' are rare in speech.",
        formProblems: [
          ["Dropping the 'to' by analogy with 'should': 'You ought register.'", "Board the two structures one above the other so the difference in form is visible: should + V / ought to + V."],
        ],
        phonetic: "/ˈɔːt tuː/  connected /ˈɔːtə/",
        pron: "In connected speech the two /t/ sounds merge and 'to' weakens to schwa: /ˈɔːtə/.",
        pronProblems: [
          ["Two separate /t/ sounds — /ɔːt tuː/ — which sounds unnatural.", "Drill the merged /ˈɔːtə/ inside the full sentence."],
        ],
      }),
    ],
  },

  "present continuous for actions happening now": {
    context: "What people in the room and in a set of pictures are doing.",
    blocks: [
      block({
        item: "Present continuous for actions happening now",
        marker: "She's reading a book.\nThey aren't listening.\nWhat are you doing?",
        meaning:
          "Happening at this moment, and not finished. It started before now and will go on after now.",
        source: "Swan, Practical English Usage (4th ed.) §58; Parrott, ch. 8",
        clarify:
          "Mime an action and stop halfway; ask what you are doing. Timeline with a wavy line through 'now'.\nCCQs — Is she reading now? (Yes.) Has she finished? (No.) Does she do it every day? (We don't know.)",
        meaningProblems: [
          ["Confused with the present simple for routines.", "Two timelines side by side, and a sorting task of 'now' versus 'usually' sentences."],
          ["Used with state verbs: 'I'm knowing', 'I'm liking'.", "Give the short list of common state verbs and practise them in the simple."],
        ],
        form: "am / is / are + verb-ing.\nSpelling: drop a final -e (write → writing), double a final consonant after a short stressed vowel (sit → sitting).\nNegative: isn't / aren't + -ing. Question: Is / Are + subject + -ing?",
        formProblems: [
          ["Auxiliary dropped: 'She reading.'", "Board the two parts as a pair and drill the full form."],
          ["Spelling: 'writeing', 'siting'.", "Sorting task into the three spelling groups."],
        ],
        phonetic: "/ʃiːz ˈriːdɪŋ/ · /wɒt ə juː ˈduːɪŋ/",
        pron: "The auxiliary contracts and weakens — 'she's', 'they're', and 'are you' as /əjuː/. -ing is /ɪŋ/.",
        pronProblems: [
          ["Full forms throughout, which sounds laboured.", "Drill contractions from the start and board them contracted."],
          ["-ing as /ɪn/ or /ɪŋɡ/.", "Model the velar nasal without the hard /ɡ/ and drill."],
        ],
      }),
    ],
  },
};

// ------------------------------------------------------------- functional

const FUNCTIONAL = {
  "making suggestions": {
    context: "Deciding together what to do on a free evening.",
    blocks: [
      block({
        item: "Making and responding to suggestions, among friends",
        register: "Informal",
        marker:
          "Why don't we get something to eat?\nWe could go to the cinema.\nHow about Thursday?\nShall we meet at seven?",
        meaning:
          "The speaker puts an idea to the group without deciding for them. All four are tentative — they invite an answer. 'Shall we' is closest to a decision; 'could' is the most open.",
        source: "Swan, Practical English Usage (4th ed.) §507; coursebook functional language reference",
        clarify:
          "Set the situation first: two friends with a free evening and no plan. Elicit the exponents onto a board list rather than presenting them.\nCCQs — Am I telling them what to do? (No.) Can they say no? (Yes.) Am I asking a real question about the future? (No, I'm suggesting.)",
        meaningProblems: [
          ["Learners hear 'Why don't we…' as a real question about a reason.", "Show it as a fixed phrase in the suggestion set and check with 'am I asking why?' (No.)"],
          ["Suggestions come out as commands because the L1 imperative is neutral and the English one is not.", "Contrast 'Let's go' with 'We could go' and ask which gives the other person room."],
        ],
        form: "Why don't we + bare infinitive?\nWe could + bare infinitive.\nHow about + noun or -ing?\nShall we + bare infinitive?\nAll are followed by the BASE form except 'How about', which takes a noun or -ing.",
        formProblems: [
          ["'How about to go?'", "Board the pattern with the -ing and drill transformations from the other exponents."],
          ["'Shall we to meet?'", "Mark the bare infinitive on the board and drill."],
        ],
        phonetic: "/waɪ dəʊnt wi/ · /wi kʊd/ · /haʊ əˈbaʊt/ · /ʃəl wi/",
        pron: "All four are said as single groups with the stress on the content word, and the auxiliaries weaken. Rising intonation at the end is what makes it a suggestion rather than an instruction.",
        pronProblems: [
          ["Flat or falling intonation, which makes a suggestion sound like an order.", "Model both, ask which one they'd rather hear, then drill the rise."],
          ["Each word stressed separately.", "Drill the whole phrase as one unit, backchaining from the end."],
        ],
      }),
    ],
  },

  "ordering in a cafe": {
    context: "Ordering at the counter in a busy café.",
    blocks: [
      block({
        item: "Ordering food and drink at a counter",
        register: "Neutral",
        marker:
          "Could I have a flat white, please?\nCan I get a cheese sandwich?\nTo take away, please.\nAnything else? — No, that's all, thanks.",
        meaning:
          "A request to buy, made politely to someone serving. 'Could I have' is the safest and most widely polite; 'Can I get' is common and informal, and some older speakers dislike it. 'I want' is understood but sounds rude.",
        source: "Cambridge Learner's Dictionary; coursebook service-encounter reference",
        clarify:
          "Set the café up with two chairs and a counter, and model the whole exchange before analysing any of it.\nCCQs — Am I asking if it is possible? (No, I'm ordering.) Is the other person my friend? (No.) Is 'I want a coffee' polite? (No.)",
        meaningProblems: [
          ["'I want…', which is grammatically fine and socially wrong.", "Put both on the board and ask which one they'd like to hear if they worked there."],
          ["Over-formality: 'Would you be so kind as to…'", "Show the register scale and place the exponents on it."],
        ],
        form: "Could / Can + I + have / get + a noun phrase + please?\n'please' goes at the end, or after 'I' in a very polite request.\nThe answer to 'Anything else?' is a short phrase, not a sentence.",
        formProblems: [
          ["'Could I to have…'", "Mark the bare infinitive on the board."],
          ["'please' inserted mid-phrase in the wrong place.", "Drill the whole exponent as a fixed chunk so the word order is learned whole."],
        ],
        phonetic: "/kʊd aɪ ˈhæv/ · /kən aɪ ˈɡet/ · /ˈflæt waɪt/",
        pron: "Said as one group with the stress on the item ordered. 'Could I' links as /kʊdaɪ/ and 'can' weakens to /kən/. A polite fall on 'please' at the end.",
        pronProblems: [
          ["Word-by-word delivery, which is hard for a busy server to follow.", "Backchain the whole order from the item outwards."],
          ["Strong /kæn/, which sounds abrupt.", "Drill the weak form inside the request."],
        ],
      }),
    ],
  },

  apologising: {
    context: "Being late, and putting it right.",
    blocks: [
      block({
        item: "Apologising, and responding to an apology",
        register: "Varies — see notes",
        marker:
          "I'm really sorry I'm late.\nSorry about that.\nI do apologise for the delay.\n— Don't worry about it. / That's all right.",
        meaning:
          "The speaker takes responsibility for something that inconvenienced the listener. Weight varies: 'Sorry about that' is light and everyday; 'I'm really sorry' is genuine and personal; 'I do apologise' is formal and typical of someone speaking for an organisation.",
        source: "Swan, Practical English Usage (4th ed.) §545; coursebook functional reference",
        clarify:
          "Three short situations on cards — a friend, a colleague, a customer — and match the exponents to them.\nCCQs — Which one would you say to a close friend? (Sorry about that.) Which would a receptionist say? (I do apologise.) Does the last one sound warmer or more distant? (More distant.)",
        meaningProblems: [
          ["Register mismatch: 'I do apologise' to a flatmate.", "Keep the three situations visible on the board and drill each exponent into its own situation."],
          ["Learners apologise where English would thank: 'Sorry for waiting' instead of 'Thanks for waiting'.", "Contrast the pair directly and ask which one the listener would rather hear."],
        ],
        form: "Sorry (about + noun / for + -ing / that + clause).\nI'm sorry + clause.\nI apologise for + noun or -ing.\nNote the -ing after the prepositions: 'Sorry for keeping you waiting', not 'to keep'.",
        formProblems: [
          ["'Sorry for be late.'", "Board 'for + -ing' and drill transformations."],
          ["'I'm apologise.'", "Show that 'apologise' is the verb and 'sorry' the adjective; board the two patterns side by side."],
        ],
        phonetic: "/ˈsɒri/ · /aɪ əˈpɒlədʒaɪz/",
        pron: "Sincerity is carried by intonation and by the stressed intensifier — a wide fall on 'really' or on 'sorry'. A flat 'sorry' reads as insincere in English even when it is not meant that way.",
        pronProblems: [
          ["Flat intonation, heard as not meaning it.", "Model a flat and a falling version and ask which one they believe; then drill."],
          ["/ˈsɔːri/ with the wrong vowel.", "Model /ˈsɒri/ and drill; note the difference from 'sorry' in some other varieties if it comes up."],
        ],
      }),
    ],
  },

  "making arrangements": {
    context: "Fixing a time to meet next week.",
    blocks: [
      block({
        item: "Making arrangements: fixing a time and a place",
        register: "Neutral",
        marker:
          "Are you free on Tuesday?\nDoes Thursday suit you?\nLet's say six o'clock.\nI'll meet you outside the station.",
        meaning:
          "Two people settling a plan together. 'Are you free' and 'Does X suit you' check availability; 'Let's say' proposes and half-decides; 'I'll' announces a decision made at the moment of speaking.",
        source: "Swan, Practical English Usage (4th ed.) §58 (arrangements) and §213 ('will' for decisions)",
        clarify:
          "Two diaries on the board with different days blocked out; the class has to find the meeting.\nCCQs — Have we agreed a time yet? (Not until 'let's say'.) Did I decide 'I'll meet you' before this conversation? (No, just now.)",
        meaningProblems: [
          ["'I will meet you' used for an arrangement already fixed, where the present continuous belongs.", "Contrast 'I'm meeting Ana at six' (already arranged) with 'I'll meet you outside' (decided now)."],
          ["'Are you free' heard as an enquiry about cost.", "Give the situation first and CCQ 'am I asking about money?' (No.)"],
        ],
        form: "Are you free + on + day / at + time?\nDoes + day + suit you?\nLet's + bare infinitive.\nI'll + bare infinitive.\nPrepositions: on with days, at with clock times, in with months.",
        formProblems: [
          ["'in Tuesday', 'on six o'clock'.", "Board the three prepositions with example slots and drill a substitution."],
          ["'Let's to meet.'", "Mark the bare infinitive on the board."],
        ],
        phonetic: "/ə juː ˈfriː/ · /lets ˈseɪ/ · /aɪl ˈmiːt juː/",
        pron: "'Are you' weakens to /əjuː/ and 'I'll' is a single syllable /aɪl/ — learners who say 'I will' sound like they are insisting. Rising intonation on the availability questions.",
        pronProblems: [
          ["'I will' in full, which changes the feel of the offer.", "Drill the contraction and board it contracted."],
          ["Falling intonation on 'Are you free on Tuesday?', which sounds like pressure.", "Model both and drill the rise."],
        ],
      }),
    ],
  },
};

// ------------------------------------------------------------- vocabulary

const v = (item, definition, convey, clarification, form, problems) => ({
  item,
  definition,
  convey,
  clarification,
  form,
  problems,
});

const VOCAB = {
  "everyday objects": {
    context: "The things people carry with them every day.",
    reference: "Cambridge Learner's Dictionary; coursebook elementary word list",
    rows: [
      v("a wallet /ˈwɒlɪt/ (n)", "a small flat case for money and cards", "Hold one up", "Do you keep money in it? (Yes.) Is it big? (No.) Do you put it in your pocket? (Yes.)", "Countable: a wallet / wallets.", "Confused with 'purse'. Stress on the first syllable."),
      v("keys /kiːz/ (n)", "small metal objects for opening a door", "Hold a keyring up and jingle it", "Do you open a door with it? (Yes.) Is it made of paper? (No.)", "Countable: a key / keys. Also 'a keyring'.", "The plural /z/, not /s/. 'key' confused with 'quay'."),
      v("an umbrella /ʌmˈbrelə/ (n)", "a thing you hold over your head when it rains", "Picture, plus a mime of opening one", "Do you use it in the sun? (Sometimes.) In the rain? (Yes.) Is it above your head? (Yes.)", "Countable: an umbrella — note 'an'.", "Stress on the SECOND syllable, not the first. The article 'an'."),
      v("a charger /ˈtʃɑːdʒə/ (n)", "the cable you use to put power into a phone", "Hold one up", "Is it for your phone? (Yes.) Does it give power? (Yes.) Is it the phone itself? (No.)", "Countable: a charger / chargers. From the verb 'to charge'.", "/tʃ/ at the start. Confused with the verb."),
      v("sunglasses /ˈsʌnɡlɑːsɪz/ (n)", "dark glasses you wear in bright sun", "Put a pair on", "Do you wear them in the sun? (Yes.) Can you see through them? (Yes.) Is there one or two?", "Plural only — 'a pair of sunglasses', never 'a sunglass'.", "Treated as singular: 'my sunglasses is'. Stress on 'sun'."),
      v("a receipt /rɪˈsiːt/ (n)", "the piece of paper a shop gives you after you pay", "Show one from a pocket", "Do you get it before or after you pay? (After.) Is it paper? (Yes.) Does it show the price? (Yes.)", "Countable: a receipt / receipts.", "The 'p' is SILENT. Confused with 'recipe'."),
    ],
  },

  "food and drink": {
    context: "What people in the class eat and drink on an ordinary day.",
    reference: "Cambridge Learner's Dictionary; coursebook food unit",
    rows: [
      v("breakfast /ˈbrekfəst/ (n)", "the first meal of the day", "Picture of a morning table", "Is it in the morning? (Yes.) Is it the first meal? (Yes.)", "Uncountable in general use: 'have breakfast', no article.", "'I have a breakfast.' Spelling-led /ˈbreɪkfɑːst/."),
      v("a snack /snæk/ (n)", "a small amount of food between meals", "Picture of someone eating crisps at a desk", "Is it a big meal? (No.) Is it between meals? (Yes.)", "Countable: a snack / snacks. Also the verb 'to snack'.", "Confused with 'meal'. The consonant cluster /sn/."),
      v("fresh /freʃ/ (adj)", "recently made or picked, not old or frozen", "Two pictures: a market stall and a freezer", "Is it old? (No.) Is it from the freezer? (No.) Is it good? (Usually.)", "Adjective: 'fresh bread'. Comparative 'fresher'.", "Confused with 'cold'. /e/ not /eɪ/."),
      v("a takeaway /ˈteɪkəweɪ/ (n)", "a meal you buy cooked and eat at home", "Picture of a delivery box", "Do you cook it? (No.) Do you eat it in the restaurant? (No.) Where do you eat it? (At home.)", "Countable: a takeaway / takeaways. In US English, 'takeout'.", "Confused with 'restaurant'. Stress on 'take'."),
      v("thirsty /ˈθɜːsti/ (adj)", "wanting to drink", "Mime, plus a picture of someone in the heat", "Do you want food? (No.) Do you want a drink? (Yes.) Is it a feeling? (Yes.)", "Adjective: 'I'm thirsty', not 'I have thirsty'.", "'I have thirst' from L1. The /θ/ sound."),
      v("delicious /dɪˈlɪʃəs/ (adj)", "tasting very good", "Facial expression, plus a picture", "Does it taste good? (Yes.) A little good or very good? (Very.) Can I say 'very delicious'? (No — it's already very.)", "Adjective, not gradable. No 'very delicious'.", "'very delicious'. Stress on the SECOND syllable."),
    ],
  },

  "food and cooking": {
    context: "Talking about the food people cook at home, and how they make it.",
    reference: "Cambridge Learner's Dictionary; Speakout Elementary, the food unit",
    rows: [
      v("fry /fraɪ/ (v)", "to cook food in hot oil in a pan", "Picture of an egg cooking in a pan", "Is there oil? (Yes.) Is it in water? (No.) Is it in the oven? (No.)", "Regular: fry / fried / fried — y becomes ied. Also an adjective: 'a fried egg'.", "Confused with 'boil'. Spelling of the past form. /aɪ/ shortened to /a/."),
      v("boil /bɔɪl/ (v)", "to cook food in very hot water", "Picture of pasta in a pan of bubbling water", "Is there water? (Yes.) Is the water very hot? (Yes.) Can we boil an egg? (Yes.)", "Regular: boil / boiled / boiled. Also 'boiled potatoes'.", "Some L1s use one verb for boiling and frying. The diphthong /ɔɪ/."),
      v("roast /rəʊst/ (v)", "to cook meat or vegetables in the oven", "Picture of a chicken in an oven", "Where is the food? (In the oven.) Is there a lot of water? (No.)", "Regular: roast / roasted / roasted. Also an adjective: 'roast chicken'.", "/əʊ/ produced as /ɒ/. Confusion with 'bake'."),
      v("chop /tʃɒp/ (v)", "to cut food into small pieces with a knife", "Mime, then a picture of chopped onions", "Do I use a knife? (Yes.) Big pieces or small? (Small.) Is it cooking? (No — it's before.)", "Regular, doubles the p: chop / chopped / chopped. Also 'chopped tomatoes'.", "The double consonant in the past form. /tʃ/ at the start of the word."),
      v("a recipe /ˈresəpi/ (n)", "a set of instructions telling you how to cook something", "Hold up the recipe card from the coursebook", "Can you eat it? (No.) Does it tell you what to do? (Yes.) Is it a list of steps? (Yes.)", "Countable: a recipe / recipes. 'a recipe FOR something'.", "The spelling misleads — three syllables, /ˈresəpi/, not /rɪˈsaɪp/. Confused with 'receipt'."),
      v("spicy /ˈspaɪsi/ (adj)", "food with a strong, hot taste from spices", "Picture of chillies, plus a gesture", "Is it sweet? (No.) Does it make your mouth hot? (Yes.) Is it about temperature? (No.)", "Adjective: 'a spicy sauce', 'This is very spicy.' Comparative 'spicier'.", "Confused with 'hot' meaning temperature. /aɪ/ in the first syllable."),
    ],
  },

  "work and study": {
    context: "What the people in the class do, and what they are studying.",
    reference: "Cambridge Learner's Dictionary; coursebook work unit",
    rows: [
      v("a colleague /ˈkɒliːɡ/ (n)", "someone you work with", "Picture of two people at desks", "Do you work with them? (Yes.) Are they your friend? (Maybe.) Do you pay them? (No.)", "Countable: a colleague / colleagues.", "Confused with 'college'. Stress on the first syllable."),
      v("a deadline /ˈdedlaɪn/ (n)", "the time by which something must be finished", "Calendar with a date circled in red", "Is it a time? (Yes.) Can you finish after it? (Not really.) Is it before or after the work? (After.)", "Countable: a deadline / deadlines. 'meet a deadline', 'miss a deadline'.", "The collocation — 'do a deadline'. /e/ in the first syllable."),
      v("a shift /ʃɪft/ (n)", "a period of work, especially when others work at other times", "Picture of a hospital rota", "Is it all day? (No.) Do other people work at different times? (Yes.)", "Countable: a shift / shifts. 'work a night shift'.", "Confused with 'schedule'. Short /ɪ/."),
      v("a degree /dɪˈɡriː/ (n)", "a qualification from a university", "Show a graduation photo", "Is it from a school? (No, a university.) Is it a piece of paper? (Yes.) Is it about temperature? (Not here.)", "Countable: a degree / degrees. 'a degree IN economics'.", "The preposition — 'a degree of economics'. Stress on the second syllable."),
      v("to apply /əˈplaɪ/ (v)", "to ask officially for a job or a place", "Show a form being filled in", "Do you want the job? (Yes.) Have you got it yet? (No.) Do you write something? (Usually.)", "Regular: apply / applied / applied. 'apply FOR a job', 'apply TO a university'.", "Wrong preposition. Spelling of 'applied'."),
      v("experience /ɪkˈspɪəriəns/ (n)", "the knowledge you get from doing a job", "Two CVs on the board, one longer", "Is it something you learn at school? (No.) Do you get it by doing? (Yes.)", "UNCOUNTABLE in this sense: 'I have experience', never 'experiences'. Countable when it means an event.", "'I have a lot of experiences.' Stress on the second syllable."),
    ],
  },

  "describing character": {
    context: "Describing the people in the class's families.",
    reference: "Cambridge Learner's Dictionary; coursebook personality unit",
    rows: [
      v("generous /ˈdʒenərəs/ (adj)", "happy to give money, time or help", "Story: someone who always pays for coffee", "Do they give? (Yes.) Do they want something back? (No.) Is it good? (Yes.)", "Adjective. 'generous WITH their time', 'generous TO someone'.", "Confused with 'kind'. /dʒ/ at the start."),
      v("reliable /rɪˈlaɪəbl/ (adj)", "someone who does what they say they will", "Story: the friend who is always on time", "If they say they'll come, do they come? (Yes.) Can you trust them? (Yes.)", "Adjective. Opposite 'unreliable'. From 'rely on'.", "Stress on the second syllable. Confused with 'responsible'."),
      v("stubborn /ˈstʌbən/ (adj)", "not willing to change their mind", "Mime folded arms; a short story", "Do they change their mind easily? (No.) Is it usually a compliment? (No.)", "Adjective. 'as stubborn as a mule' is a common simile.", "The double 'b' is one sound. Confused with 'strong'."),
      v("easy-going /ˌiːziˈɡəʊɪŋ/ (adj)", "relaxed, not easily worried or annoyed", "Contrast two short descriptions", "Do they get angry quickly? (No.) Are they relaxed? (Yes.) Is it positive? (Yes.)", "Adjective, hyphenated. Usually after 'be': 'She's very easy-going.'", "Stress pattern — two stresses, the main one on 'go'. Written as two words."),
      v("outgoing /ˌaʊtˈɡəʊɪŋ/ (adj)", "friendly and confident with new people", "Picture of someone at a party talking to strangers", "Do they like meeting people? (Yes.) Are they shy? (No.)", "Adjective. Opposite 'shy' or 'reserved'.", "Confused with 'going out'. Stress on 'go'."),
      v("patient /ˈpeɪʃnt/ (adj)", "able to wait or deal with problems without getting annoyed", "Mime waiting calmly in a long queue", "Are they waiting? (Maybe.) Do they get annoyed? (No.) Is it about a hospital here? (No.)", "Adjective. Noun 'patience'. Homograph with the hospital noun.", "Confused with the noun 'a patient'. /eɪ/ in the first syllable."),
    ],
  },

  "adjectives of personality": {
    context: "Talking about the people the class works with.",
    reference: "Cambridge Learner's Dictionary; coursebook personality unit",
    rows: [
      v("confident /ˈkɒnfɪdənt/ (adj)", "sure about your own ability", "Picture of someone presenting easily", "Do they believe in themselves? (Yes.) Are they nervous? (No.)", "Adjective. Noun 'confidence'. 'confident ABOUT something'.", "Confused with 'confidential'. Stress on the first syllable."),
      v("hard-working /ˌhɑːdˈwɜːkɪŋ/ (adj)", "putting a lot of effort into work", "Picture of someone still at a desk at night", "Do they work a lot? (Yes.) Is it positive? (Yes.)", "Adjective, hyphenated, usually before the noun or after 'be'.", "'hardly working' means the opposite. Two stresses."),
      v("shy /ʃaɪ/ (adj)", "nervous about meeting or talking to new people", "Mime, plus a picture", "Do they like big groups? (Not really.) Is it a bad thing? (No.)", "Adjective. Comparative 'shyer'. Opposite 'outgoing'.", "Confused with 'quiet'. The diphthong /aɪ/."),
      v("bossy /ˈbɒsi/ (adj)", "always telling other people what to do", "Short story about a group task", "Do they give orders? (Yes.) Are they the boss? (Not necessarily.) Is it a compliment? (No.)", "Adjective, informal, always negative. From 'boss'.", "Assumed to be neutral because 'boss' is. Short /ɒ/."),
      v("ambitious /æmˈbɪʃəs/ (adj)", "wanting to be successful", "Picture of a career ladder", "Do they want more? (Yes.) Is it about now or the future? (The future.)", "Adjective. Noun 'ambition'. 'ambitious TO do something'.", "Stress on the second syllable. The /ʃ/ in the middle."),
      v("sociable /ˈsəʊʃəbl/ (adj)", "enjoying being with other people", "Picture of a group having dinner", "Do they like being alone? (Not usually.) Do they like company? (Yes.)", "Adjective. Not the same as 'social', which describes the thing not the person.", "'social' used for people. Stress on the first syllable."),
    ],
  },

  "travel and transport": {
    context: "How the class gets around the city.",
    reference: "Cambridge Learner's Dictionary; coursebook travel unit",
    rows: [
      v("a journey /ˈdʒɜːni/ (n)", "the act of travelling from one place to another", "Map with a line drawn between two points", "Is it the travelling or the place? (The travelling.) Is it there and back? (Not necessarily.)", "Countable: a journey / journeys. 'go ON a journey'.", "Confused with 'trip' and 'travel'. /dʒ/ at the start."),
      v("a platform /ˈplætfɔːm/ (n)", "the place in a station where you wait for a train", "Photo of a station", "Is it in a station? (Yes.) Do you wait there? (Yes.) Is it the train? (No.)", "Countable: a platform / platforms. 'on platform 4'.", "Preposition — 'in platform 4'. Stress on the first syllable."),
      v("to commute /kəˈmjuːt/ (v)", "to travel regularly between home and work", "Picture of a rush-hour train", "Is it every day? (Usually.) Is it for a holiday? (No.) Is it between home and work? (Yes.)", "Regular: commute / commuted. Noun 'a commute', 'a commuter'.", "Used for any travel. Stress on the second syllable."),
      v("a fare /feə/ (n)", "the money you pay to travel", "Show a ticket with a price", "Is it money? (Yes.) Do you pay it for a ticket? (Yes.) Is it food? (No.)", "Countable: a fare / fares.", "Homophone with 'fair'. Confused with 'fee' and 'ticket'."),
      v("rush hour /ˈrʌʃ aʊə/ (n)", "the time of day when traffic is busiest", "Photo of a packed train", "Is it busy? (Yes.) Is it all day? (No.) Morning and evening? (Yes.)", "Usually uncountable and used without an article: 'in rush hour', 'at rush hour'.", "'in the rush hours'. Linking between the two words."),
      v("to get stuck /ɡet ˈstʌk/ (v)", "to be unable to move on", "Mime being caught in traffic", "Can you move? (No.) Do you want to move? (Yes.) Is it your choice? (No.)", "Irregular: get / got / got + stuck. 'get stuck IN traffic'.", "The preposition. The /ʌ/ vowel."),
    ],
  },

  "air travel": {
    context: "Getting through an airport and onto a plane.",
    reference: "Cambridge Learner's Dictionary; coursebook travel unit",
    rows: [
      v("to check in /tʃek ˈɪn/ (v)", "to report your arrival at the airport and hand over your bags", "Photo of a check-in desk", "Is it at the start or the end? (The start.) Do you give them your bag? (Usually.) Is it on the plane? (No.)", "Phrasal verb, separable with an object: 'check in your bag' / 'check your bag in'. Noun 'check-in'.", "The separation. Confused with hotel check-in, which is the same phrase."),
      v("a boarding pass /ˈbɔːdɪŋ pɑːs/ (n)", "the card that lets you get on the plane", "Show one", "Do you need it to get on? (Yes.) Is it your passport? (No.) Is it your ticket? (Almost.)", "Countable: a boarding pass / passes.", "Confused with 'ticket' and 'passport'. Stress on 'board'."),
      v("hand luggage /ˈhænd lʌɡɪdʒ/ (n)", "the small bag you take on the plane with you", "Show a small bag", "Do you carry it on? (Yes.) Is it in the hold? (No.) Is it big? (No.)", "UNCOUNTABLE: 'some hand luggage', never 'a hand luggage' or 'hand luggages'. US English 'carry-on'.", "Made countable. The /dʒ/ ending."),
      v("a gate /ɡeɪt/ (n)", "the place in an airport where you get on the plane", "Airport screen showing gate numbers", "Is it in the airport? (Yes.) Is it the plane? (No.) Do you go there before you get on? (Yes.)", "Countable: 'gate 12', 'at gate 12'.", "Confused with the garden sense. The /eɪ/ vowel."),
      v("to take off /teɪk ˈɒf/ (v)", "to leave the ground and start flying", "Gesture with a flat hand rising", "Is the plane on the ground? (At the start, yes.) Is it the beginning or the end of the flight? (The beginning.)", "Irregular phrasal verb: take / took / taken off. Noun 'takeoff'. Intransitive here.", "Confused with 'land'. Also means 'remove clothing' — flag it."),
      v("delayed /dɪˈleɪd/ (adj)", "happening later than planned", "Airport board with DELAYED beside a flight", "Is it on time? (No.) Is it cancelled? (No.) Will it happen? (Yes, later.)", "Adjective from the verb 'to delay'. 'The flight is delayed.' Noun 'a delay'.", "Confused with 'cancelled'. Stress on the second syllable."),
    ],
  },

  "places in a town": {
    context: "Giving a visitor directions around the neighbourhood.",
    reference: "Cambridge Learner's Dictionary; coursebook town unit",
    rows: [
      v("a chemist /ˈkemɪst/ (n)", "a shop selling medicine", "Picture of a green cross sign", "Do you buy medicine there? (Yes.) Is it a hospital? (No.)", "Countable: a chemist / chemists. US English 'drugstore' or 'pharmacy'.", "The 'ch' is /k/. Confused with a scientist."),
      v("a library /ˈlaɪbrəri/ (n)", "a place where you borrow books", "Picture of shelves", "Do you buy the books? (No.) Do you give them back? (Yes.)", "Countable: a library / libraries.", "False friend in several L1s where it means bookshop. Three syllables, not two."),
      v("a crossroads /ˈkrɒsrəʊdz/ (n)", "a place where two roads cross", "Simple map with two lines crossing", "How many roads? (Two.) Do they meet? (Yes.)", "Singular despite the -s: 'a crossroads'. Plural is also 'crossroads'.", "Treated as plural. Confused with 'roundabout'."),
      v("opposite /ˈɒpəzɪt/ (prep)", "on the other side of, and facing", "Draw a street with two shops facing each other", "Are they on the same side? (No.) Can you see one from the other? (Yes.) Are they next to each other? (No.)", "Preposition: 'opposite the bank', with no 'to' or 'from'.", "'opposite to the bank'. Three syllables, stress on the first."),
      v("just around the corner /dʒəst əˈraʊnd ðə ˈkɔːnə/", "very close, a short walk away", "Gesture round a corner on a map", "Is it far? (No.) Can you see it now? (Not yet.) Is it a long walk? (No.)", "Fixed phrase. Also used for time: 'summer is just around the corner'.", "Said word by word. The linking in 'around the'."),
      v("a pedestrian crossing /pəˈdestriən ˈkrɒsɪŋ/ (n)", "the marked place where people cross the road", "Photo of a zebra crossing", "Is it for cars? (No.) Is it for people? (Yes.) Is it safe? (Safer.)", "Countable. In British English also 'a zebra crossing'.", "Long and hard to say — teach it as a chunk. Stress on 'des' and 'cross'."),
    ],
  },
};

// ------------------------------------------------------------------ lookup

/** Returns the analysis sheet for a plan's main aim, or null for a skills lesson. */
export function analysisForAim(mainAim) {
  const aim = (mainAim ?? "").toLowerCase();
  if (!aim) return null;

  for (const [key, sheet] of Object.entries(GRAMMAR)) {
    if (aim.includes(key)) {
      return { type: "grammar", is_main_aim: true, context: sheet.context, blocks: sheet.blocks, vocab_rows: [], vocab_reference: null };
    }
  }
  for (const [key, sheet] of Object.entries(FUNCTIONAL)) {
    if (aim.includes(key)) {
      return { type: "function", is_main_aim: true, context: sheet.context, blocks: sheet.blocks, vocab_rows: [], vocab_reference: null };
    }
  }
  for (const [key, sheet] of Object.entries(VOCAB)) {
    if (aim.includes(key)) {
      return { type: "vocab", is_main_aim: true, context: sheet.context, blocks: [], vocab_rows: sheet.rows, vocab_reference: sheet.reference };
    }
  }
  return null;
}

export const ANALYSIS_POINT_COUNT =
  Object.keys(GRAMMAR).length + Object.keys(FUNCTIONAL).length + Object.keys(VOCAB).length;
