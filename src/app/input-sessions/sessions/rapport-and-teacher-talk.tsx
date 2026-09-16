"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RevealCard } from "@/components/input-sessions/reveal-card";
import { ChoiceScenarioCard, type ChoiceScenario } from "@/components/input-sessions/choice-scenario";
import { TrainerNotes, RunningThisSession } from "@/components/input-sessions/trainer-notes";
import { GOLD, MUTED, TEAL } from "@/components/input-sessions/tokens";

// Written 13 Sep 2026, not ported -- there was no design for it.
//
// The criteria map found twelve criteria no input session on the course
// taught. Two of them were the ones tutors write about most in TP feedback
// and neither had a session anywhere:
//
//   1d  establishing good rapport with learners and ensuring they are fully
//       involved in learning activities
//   2a  adjusting their own use of language in the classroom according to
//       the learner group and the context
//
// They are one session because they are one thing: what a teacher does with
// their presence and their voice. Talking over learners' heads is a rapport
// failure as much as a language one, and every minute of teacher talk is a
// minute a learner is not talking. Cambridge's own guidance bullets for both
// criteria are the spine of the stages below.
//
// Placed after TP1 on purpose. Trainees have now heard themselves teach; the
// TTT count lands differently when you have just done it.

const RED = "oklch(45% 0.15 27)";

// A real-shaped exchange from a pre-intermediate lesson. Every line is
// marked T or S; the split is the point, and it is worse than anyone guesses.
const TRANSCRIPT: { speaker: "T" | "S"; text: string }[] = [
  { speaker: "T", text: "OK so now what we're going to do, we're going to do a little activity, it's a speaking activity, so you're going to work with your partner, the person next to you, OK?" },
  { speaker: "S", text: "Yes." },
  { speaker: "T", text: "And what you're going to do is you're going to ask each other about your weekend, so what did you do at the weekend, did you go anywhere, did you see anyone, that kind of thing, OK, so just have a chat about it." },
  { speaker: "S", text: "With partner?" },
  { speaker: "T", text: "Yes, with your partner, the person sitting next to you, so just turn to them and have a conversation about your weekend, and you've got about three minutes, OK, so off you go." },
  { speaker: "S", text: "I go to my sister house." },
  { speaker: "T", text: "Ah lovely, you went to your sister's house, yes, and what did you do there, did you have dinner, did you watch something?" },
  { speaker: "S", text: "We eat and watch film." },
  { speaker: "T", text: "Lovely, you ate and you watched a film, that sounds like a nice weekend, OK everyone, keep going." },
];

const GRADING: ChoiceScenario[] = [
  {
    text: "Setting up a pairwork task with a pre-intermediate class.",
    choices: [
      "“Right, so if you could possibly turn to the person beside you and have a bit of a chat about it.”",
      "“Work in pairs. Talk about your weekend. Three minutes.”",
      "“You talk now partner yes? Weekend. Three minute.”",
    ],
    correctIndex: 1,
    feedback:
      "The second. The first is padded with hedges a pre-intermediate learner has to unpick before finding the instruction. The third is the trap: it is shorter, but it is not English — grading your language means making it simpler AND keeping it natural, not speaking a broken version of it.",
  },
  {
    text: "Explaining what “commute” means to an A2 class.",
    choices: [
      "“It’s the journey you make to work, usually every day.”",
      "“A commute is a regular journey undertaken between one’s residence and place of employment.”",
      "“Commute — you know, travel, go, work, every day, yes?”",
    ],
    correctIndex: 0,
    feedback:
      "The first. The second is accurate and completely out of reach. The third is a string of words, not a sentence — the learner has to assemble the meaning themselves and has no model to copy.",
  },
  {
    text: "A learner says “I am agree with you.” You want to respond in the moment without stopping the discussion.",
    choices: [
      "“I agree with you — good. Carry on.”",
      "“No, we don’t say ‘I am agree’, we say ‘I agree’, because agree is a verb, not an adjective.”",
      "Say nothing and note it for delayed correction.",
    ],
    correctIndex: 0,
    feedback:
      "The first — a natural, accurate recast that models the form without a grammar lecture mid-discussion. The second stops the conversation dead. The third is fine too, and often right; but a recast costs nothing and keeps the floor with the learner.",
  },
];

const RAPPORT: ChoiceScenario[] = [
  {
    text: "You arrive five minutes early and chat to the two students already there about their journey in.",
    choices: ["Builds rapport", "Just being liked"],
    correctIndex: 0,
    feedback:
      "Builds it. Cambridge’s own wording is “interact naturally with learners before, during and after the lesson” — before and after are in the criterion for a reason.",
  },
  {
    text: "You praise every answer with “Great!”, “Perfect!”, “Well done!”, including the wrong ones.",
    choices: ["Builds rapport", "Just being liked"],
    correctIndex: 1,
    feedback:
      "Just being liked — and it stops meaning anything. Praise that is given for everything carries no information, and learners work out very fast that it is automatic.",
  },
  {
    text: "You use learners’ names while teaching, not only when taking the register — and you have checked how each one is pronounced.",
    choices: ["Builds rapport", "Just being liked"],
    correctIndex: 0,
    feedback:
      "Builds it, and it is the cheapest thing on this list. Getting a name wrong for four weeks is a harder thing to undo than most trainees realise.",
  },
  {
    text: "A learner gives a long, halting answer. You wait, keep eye contact, and let them finish.",
    choices: ["Builds rapport", "Just being liked"],
    correctIndex: 0,
    feedback:
      "Builds it. Waiting is a rapport move and a TTT move at once — filling the silence is the single most common way trainees take the floor back.",
  },
  {
    text: "You tell the class a long, funny story about your own weekend to warm them up.",
    choices: ["Builds rapport", "Just being liked"],
    correctIndex: 1,
    feedback:
      "Careful. A short personal example gives learners something to respond to; a long one is teacher talk with a smile on it. The test is whether it hands the floor over or keeps it.",
  },
];

const INVOLVEMENT: { move: string; why: string }[] = [
  {
    move: "Ask, then pause, then nominate",
    why: "Asking “anyone?” gets you the same three hands every time. Ask the question, leave three full seconds, then name someone — everyone has to think, because anyone might be next.",
  },
  {
    move: "Check answers in pairs before whole-class feedback",
    why: "A learner who has already said the answer to one person will say it to the room. It also tells you where the class actually is before you find out in public.",
  },
  {
    move: "Hands down, everybody writes",
    why: "Mini-whiteboards, a scrap of paper, fingers held up for A/B/C. Every learner commits to an answer instead of four learners answering for twenty.",
  },
  {
    move: "Re-route the question",
    why: "“Maria said the past simple — Ahmed, do you agree?” Two learners involved in one exchange, and the second one has to have been listening.",
  },
  {
    move: "Stand where you are not the centre",
    why: "Moving to the side of the room during feedback turns it from teacher-to-class into class-to-class. Cambridge 1d asks for involvement in teacher-fronted stages too, not only in pairwork.",
  },
];

export default function RapportAndTeacherTalkSession() {
  return (
    <SessionShell
      slug="rapport-and-teacher-talk"
      title="Rapport, and how much you talk"
      intro="Two criteria that tutors write about more than almost any others, and they are the same thing from two sides: what you do with your presence, and what you do with your voice. You have now taught once — this session starts from what that sounded like."
      agenda={[
        { time: "0–5", title: "The teacher you remember", spine: GOLD },
        { time: "5–17", title: "Count the talk", spine: RED },
        { time: "17–27", title: "Grading, not dumbing down", spine: TEAL },
        { time: "27–36", title: "Rapport, or being liked", spine: TEAL },
        { time: "36–43", title: "Involved at the front", spine: TEAL },
        { time: "43–45", title: "Wrap-up", spine: GOLD },
      ]}
    >
      <RunningThisSession>
        Run this after TP1, not before it — every stage is better when trainees have heard themselves teach. The
        transcript is deliberately not a bad teacher: everything in it is kind, encouraging and well meant, which is why
        the count at the end lands.
      </RunningThisSession>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">1 · The teacher you remember · 5 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          Think of one teacher — any subject, any language — whose classes you actually wanted to be in. In pairs: what
          did they <em>do</em>? Not what they were like. What did they do.
        </p>
        <p className="text-label italic text-muted">
          Two minutes in pairs, three answers to the room. Write them on the board; you will come back to them at the end.
        </p>
      </section>

      <TalkCount />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">3 · Grading, not dumbing down · 10 minutes</h2>
          <p className="text-label text-muted">
            Cambridge 2a: “use comprehensible language… <strong className="text-ink">keep your simplified language
            natural</strong>.” Both halves matter, and the second is the one trainees drop.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {GRADING.map((s) => (
            <ChoiceScenarioCard key={s.text} scenario={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">4 · Rapport, or being liked? · 9 minutes</h2>
          <p className="text-label text-muted">
            Five things a teacher does. Rapport is not the same as being liked — the test is whether it hands the floor
            over.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {RAPPORT.map((s) => (
            <ChoiceScenarioCard key={s.text} scenario={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-h3 font-semibold text-ink">5 · Involved at the front · 7 minutes</h2>
          <p className="text-label text-muted">
            1d asks for learners “fully involved… during teacher-fronted <em>and</em> learner-centred stages”. Pairwork is
            the easy half. Five moves for the other one.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {INVOLVEMENT.map((m) => (
            <RevealCard key={m.move} question={m.move} answer={m.why} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-serif text-h3 font-semibold text-ink">Wrap-up · 2 minutes</h2>
        <p className="text-meta leading-relaxed text-ink">
          Back to the board. Which of the things your remembered teacher <em>did</em> are on this page? And one sentence
          each: the one thing you will do differently in your next TP — a rapport move, or a place you will stop talking.
        </p>
      </section>

      <TrainerNotes
        notes={[
          {
            label: "Why these two together",
            text: "They are one thing from two sides. Talking over learners' heads is a rapport failure as much as a language one, and every minute of teacher talk is a minute a learner is not talking. If you separate them, trainees treat TTT as a stopwatch problem.",
          },
          {
            label: "1 · The teacher you remember",
            text: "Push them off adjectives. \"Kind\", \"funny\", \"passionate\" are not actions. Keep asking \"what did they DO\" until you get behaviours on the board — they will almost all be 1d, and you will point at them again at the end.",
          },
          {
            label: "2 · The count",
            text: "Let them predict the split before revealing it. Most guess 60/40. The real answer is around 90/10 by words, and this teacher is doing nothing wrong in the ordinary sense — she is warm, she recasts errors well, she encourages. That is the point: the problem is invisible from inside.",
          },
          {
            label: "2 · What to cut",
            text: "Run it again as a rewrite: give them the first three teacher turns and two minutes to cut them to the bone without losing anything a learner needs. Read the best one aloud.",
          },
          {
            label: "3 · The third option is the trap",
            text: "Every grading item has a too-long option, a good option, and an ungrammatical \"simple\" one. Trainees who have been told \"keep it short\" pick the third. Name it: simplified is not the same as broken, and learners copy what they hear.",
          },
          {
            label: "4 · Praise",
            text: "The automatic-praise card is the one that starts an argument. Let it. The distinction worth landing is specific versus reflexive — \"that's the past simple, and you used it in a question\" beats \"perfect!\" every time.",
          },
          {
            label: "5 · Wait time",
            text: "Three seconds feels endless from the front. Time it in the room — ask a question, count to three aloud, then nominate. They will find it unbearable, and that is the lesson.",
          },
          {
            label: "Where this lands",
            text: "1d and 2a are assessed from TP1 onwards, so this session should have come before it and cannot. Set the transfer task explicitly: both go in tonight's plan under the stage they apply to.",
          },
        ]}
      />
    </SessionShell>
  );
}

function words(text: string): number {
  return text.trim().split(/\s+/).length;
}

function TalkCount() {
  const [marks, setMarks] = useState<Record<number, "T" | "S">>({});
  const [checked, setChecked] = useState(false);

  const allMarked = TRANSCRIPT.every((_, i) => marks[i]);
  const teacherWords = TRANSCRIPT.filter((l) => l.speaker === "T").reduce((n, l) => n + words(l.text), 0);
  const studentWords = TRANSCRIPT.filter((l) => l.speaker === "S").reduce((n, l) => n + words(l.text), 0);
  const total = teacherWords + studentWords;
  const teacherPct = Math.round((teacherWords / total) * 100);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-h3 font-semibold text-ink">2 · Count the talk · 12 minutes</h2>
        <p className="text-label text-muted">
          Three minutes of a pre-intermediate lesson. Mark each line — teacher or student — then guess the split by
          number of words before you check.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {TRANSCRIPT.map((line, i) => {
          const mark = marks[i];
          const right = checked && mark === line.speaker;
          const wrong = checked && mark && mark !== line.speaker;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-[8px] border px-3 py-2 ${
                right ? "border-primary bg-primary/5" : wrong ? "border-destructive bg-destructive/5" : "border-border bg-card"
              }`}
            >
              <span className="flex flex-none gap-1">
                {(["T", "S"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setChecked(false);
                      setMarks((m) => ({ ...m, [i]: s }));
                    }}
                    className={`size-6 rounded-full text-label font-bold ${
                      mark === s ? "bg-primary text-primary-foreground" : "border border-border text-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </span>
              <span className="text-meta leading-relaxed text-ink">{line.text}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setChecked(true)}
          disabled={!allMarked}
          className={`rounded-full px-4 py-1.5 text-label font-semibold ${
            allMarked ? "bg-primary text-primary-foreground" : "border border-border text-muted"
          }`}
        >
          {allMarked ? "Check, and show the split" : "Mark every line first"}
        </button>
      </div>

      {checked ? (
        <div className="flex flex-col gap-2 rounded-[8px] border p-4" style={{ borderColor: RED }}>
          <p className="font-serif text-h3 font-semibold text-ink">
            {teacherPct}% of the words in that exchange are the teacher’s.
          </p>
          <div className="flex h-3 overflow-hidden rounded-full">
            <span style={{ flex: teacherWords, background: RED }} />
            <span style={{ flex: studentWords, background: TEAL }} />
          </div>
          <p className="text-label" style={{ color: MUTED }}>
            {teacherWords} teacher words · {studentWords} student words, in three minutes of a speaking activity.
          </p>
          <p className="text-meta leading-relaxed text-ink">
            Nothing here is unkind or incompetent. She is warm, she recasts both errors accurately, she encourages. That
            is exactly why this is worth looking at — from inside the lesson it felt like good teaching, and the learners
            said fourteen words.
          </p>
        </div>
      ) : null}
    </section>
  );
}
