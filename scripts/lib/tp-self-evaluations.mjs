// The candidate's own voice on a taught lesson.
//
// Found 14 Sep 2026 reading the assembled document: 108 of 109 submitted
// self-evaluations answered two of the six questions and left the rest empty,
// so the one band of the record that is the candidate's own account read as
// a stub -- on their page, on the tutor's, and in the printed document.
//
// The form does not gate submit on completeness, so a partial one is
// reachable; every single one being partial in the same way is not.
//
// Six variants, rotated by candidate and TP so no two people hand in the same
// reflection and nobody repeats themselves across their own six lessons.

const SETS = [
  {
    what_went_well: `The lead-in did its job -- two minutes, everyone talking, and it gave me the topic vocabulary they already had so I cut one of the words I was going to pre-teach.`,
    what_not_as_planned: `The freer practice got six minutes instead of twelve. I over-ran the clarification stage because I kept adding examples when they already had it.`,
    evidence_of_learning: `In the freer stage four of the eight used the target form unprompted, and two self-corrected mid-sentence -- which I take as better evidence than the controlled practice, where they could have been pattern-matching.`,
    what_differently: `Set a hard stop on clarification. I would write the time on the board where I can see it, and accept that two clear examples beat five.`,
    next_tp_focus: `Timing, specifically ending the teacher-led stages when I said I would rather than when I feel finished.`,
  },
  {
    what_went_well: `Instructions. I gave them before handing out the paper, demonstrated the first item myself, and checked with a question rather than "do you understand" -- nobody started late and nobody did the wrong task.`,
    what_not_as_planned: `The pair check went quiet almost immediately because most of them had the same answers. It needed to be a comparison of something, not a confirmation.`,
    evidence_of_learning: `The detail task answers were right for the right reasons -- when I asked where in the text they found it, they could all point to the line.`,
    what_differently: `Give the pair check something to disagree about: two of the questions have a defensible second answer and I should have used those.`,
    next_tp_focus: `Designing the checking stages so they have a reason to talk, instead of just a reason to compare.`,
  },
  {
    what_went_well: `I got the whole class up and moving for the mingle, which I was nervous about, and it ran without me having to intervene once it started.`,
    what_not_as_planned: `My board work. I wrote the form up in three places as it came up instead of planning where it would go, so by feedback the board was unreadable and I had to rub things out that we still needed.`,
    evidence_of_learning: `Two learners used the structure correctly in their own questions during the mingle, which is not something the controlled practice had asked them to do.`,
    what_differently: `Sketch the board before the lesson -- which third is the target language, which third is vocabulary, which third is scrap.`,
    next_tp_focus: `Board work, planned rather than improvised.`,
  },
  {
    what_went_well: `The correction slot at the end. I had written down what I actually heard while monitoring, so the errors on the board were theirs, and they corrected four of the five between them.`,
    what_not_as_planned: `I spoke too much in the first half. Listening back in my head, I explained the context myself when I could have elicited most of it from the photographs.`,
    evidence_of_learning: `They corrected their own errors in the feedback slot without me saying who had made them, which suggests they could hear the problem once it was written down.`,
    what_differently: `Cut my own setting-up by half and ask more. The information was in the room already.`,
    next_tp_focus: `Reducing teacher talk in the lead-in and the set-up -- eliciting instead of telling.`,
  },
  {
    what_went_well: `Monitoring. I stayed out of the first minute of every pair task and did not correct anything during fluency, which I have not managed before.`,
    what_not_as_planned: `The task was too easy for two of them and they finished in half the time, then sat. I had no extension ready.`,
    evidence_of_learning: `The weaker half produced the form accurately in the controlled stage; the stronger half were already using it before we started, which is really information about my needs analysis, not their learning.`,
    what_differently: `Have one extra question written on the board for early finishers, every lesson, as a habit rather than a decision.`,
    next_tp_focus: `Planning for the range in the room -- something for the fast finishers that is not just "more of the same".`,
  },
  {
    what_went_well: `Pace. The stages were short and the lesson moved, and nobody looked lost between activities because I had the transitions planned as well as the stages.`,
    what_not_as_planned: `Concept checking. My questions were answerable with yes, so I checked nothing -- I only found out in the practice that two of them had the meaning wrong.`,
    evidence_of_learning: `Honestly, thinner than I would like. The controlled practice was accurate but the freer stage was short, so I did not see much of them using it for themselves.`,
    what_differently: `Write the concept questions out in the plan with the answers next to them, instead of trusting myself to invent them on the spot.`,
    next_tp_focus: `Concept checking questions -- written in advance, and none of them answerable with yes.`,
  },
];

/** One candidate's self-evaluation for one TP. Stable, and never repeated. */
export function selfEvaluationFor(candidateIndex, tpNumber) {
  return SETS[(candidateIndex + tpNumber) % SETS.length];
}

// --- The tutor's reply to it ----------------------------------------------
//
// `tp_feedback.self_eval_comment` is written in step 3 of the tutor's form,
// saved by the action, and read on the candidate's page, in the assembled
// document and in the PDF record -- a complete chain that had never once been
// used, so it was invisible on every seeded lesson and looked unbuilt.
//
// Indexed to match SETS: a reply that does not answer what the candidate
// actually wrote would be worse than none, because this is the one place the
// tutor responds to the candidate's own account rather than to the lesson.

const REPLIES = [
  `Your reading of the clarification stage is the right one, and it is the more useful thing to have noticed -- the over-running was a symptom. Watch what you do when they have already got it: you added examples because the silence felt early, not because they needed them.`,
  `Agreed about the pair check, and your fix is the right one. I would add that you already had the ingredients: you noticed while monitoring that two pairs disagreed about question 4, and that was the moment to send them to each other rather than to the answer key.`,
  `The board is the fair criticism and I am glad you got there first. One thing you undersold: you let the mingle run without intervening, which most people cannot do at TP1 -- the instinct is to rescue, and you resisted it.`,
  `You are right that you spoke too much, though I would put it slightly differently: the problem was not quantity, it was that you answered questions you had not yet asked. The correction slot was genuinely good and you should say so.`,
  `A fair and specific evaluation. The point about the stronger half already knowing it is exactly right, and it is a needs-analysis observation rather than a teaching one -- bring that to the Focus on the Learner assignment, it is the sort of evidence that assignment wants.`,
  `Honest, and the honesty about thin evidence is worth more than a confident claim would have been. Your fix -- writing the concept questions with their answers into the plan -- is the right one, and I want to see it in the TP{next} plan rather than in the lesson.`,
];

/** The tutor's reply to that candidate's self-evaluation, for that TP. */
export function selfEvalReplyFor(candidateIndex, tpNumber) {
  return REPLIES[(candidateIndex + tpNumber) % REPLIES.length].replace("TP{next}", `TP${tpNumber + 1}`);
}
