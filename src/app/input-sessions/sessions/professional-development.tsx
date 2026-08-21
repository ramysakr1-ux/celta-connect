"use client";

import { useState } from "react";
import { SessionShell } from "@/components/input-sessions/session-shell";
import { RunningThisSession } from "@/components/input-sessions/trainer-notes";

interface Item {
  name: string;
  note: string;
}
interface Card {
  tag: string;
  title: string;
  intro: string;
  items: Item[];
  prompt: string;
  accent?: boolean;
}

const CARDS: Card[] = [
  {
    tag: "Finding work",
    title: "Job boards & recruiters",
    intro: "Where actual vacancies get posted — general boards, and country-specific ones for popular destinations.",
    items: [
      { name: "tefl.com", note: "The longest-running dedicated TEFL job board — updated daily, searchable by country and by online/in-person." },
      { name: "Dave's ESL Café", note: "One of the oldest ESL community sites — job board plus a long-running forum of teachers discussing specific schools and cities." },
      { name: "TEFL Jobs Centre (tefl.org)", note: "Weekly-updated listings across dozens of countries, plus write-ups of what a normal contract looks like in each." },
      { name: "Teast", note: "Aggregates listings from schools and recruiters worldwide, including a lot of Asia and Southeast Asia postings." },
    ],
    prompt: 'Pick one listing on any of these sites and check: does it name a real school, or just a vague "teach abroad" recruiter? That distinction matters.',
  },
  {
    tag: "Before you go",
    title: "Visas & country requirements",
    intro: "Requirements vary enormously by country — degree requirements, sponsorship, and how the process actually works.",
    items: [
      { name: "Degree usually required", note: "Most of Asia (China, South Korea, Japan, Vietnam) and the Middle East legally require a bachelor's degree for a teaching work visa, regardless of TEFL/CELTA. The subject of the degree doesn't matter." },
      { name: "Countries that don't require one", note: "Cambodia, parts of Latin America, and some private academies in Spain will hire on a TEFL/CELTA certificate alone — worth knowing if you don't have a degree." },
      { name: "Get the job first, in most of Asia", note: "Work visas there are usually employer-sponsored and issued only once you have a signed contract — you generally shouldn't travel first hoping to find work locally." },
      { name: "Ask the embassy directly if unsure", note: "Country guides online are a starting point, but rules change — the destination country's embassy or consulate website is the actual source of truth before you commit to anything." },
    ],
    prompt: "Whoever picked this card: name one country in the group where a degree is required, and one where it isn't.",
  },
  {
    tag: "Staying sharp",
    title: "Keep developing after CELTA",
    intro: "CELTA is a start, not an endpoint — real growth mostly comes from what you do in the first year or two after it.",
    items: [
      { name: "DELTA", note: "Cambridge's advanced diploma — the natural next qualification once you have real teaching experience (usually a year or more), aimed at senior teacher / trainer / academic manager roles." },
      { name: "IATEFL", note: "The main international ELT association — an annual conference plus year-round Special Interest Groups (SIGs) on specific areas like young learners, technology, or teacher training." },
      { name: '"What They Don\'t Teach You on CELTA"', note: "A well-known blog/resource project addressing exactly the gaps a one-month course can't cover — genuinely written for teachers a few months past CELTA, not before it." },
      { name: "A supportive Director of Studies", note: "The single biggest factor in whether your first year actually develops you — worth asking about mentoring and observation support directly in any job interview, not just salary and hours." },
    ],
    prompt: "Whoever picked this card: what's one thing you'd actually ask a new employer about, based on this list, that you wouldn't have thought to ask before?",
  },
  {
    tag: "Staying safe",
    title: "Red flags & scams to watch for",
    accent: true,
    intro: "Most jobs are legitimate — but the industry has enough of a scam fringe that it's worth a checklist before signing anything.",
    items: [
      { name: "Never pay for a job", note: 'A legitimate employer pays you — not the other way round. Any "placement fee," "registration fee," or "visa processing fee" charged to you directly is a warning sign.' },
      { name: "Get the contract in writing, in a language you read", note: "Salary, hours, notice period, and who pays for flights/housing should all be explicit — verbal promises from a recruiter aren't the contract." },
      { name: "Don't surrender original documents", note: "Some disreputable employers hold a teacher's original passport or degree certificate as informal leverage. Copies only, unless an actual consulate requires the original for a visa step." },
      { name: "Search the school's name before accepting", note: 'A quick search for "[school name] + reviews" or checking it on Dave\'s ESL Café forums surfaces most patterns of past teachers\' complaints.' },
    ],
    prompt: "Whoever picked this card: which of these four would you never have thought to check yourself before this?",
  },
];

export default function ProfessionalDevelopmentSession() {
  const [idx, setIdx] = useState(0);
  const active = CARDS[idx];

  return (
    <SessionShell
      eyebrow="Connect · Resource Hub · Group task + takeaway sheet · ~30 minutes, flexible"
      title="Professional development & career advice — life after the certificate."
      intro="Lighter than the rest of this course, on purpose. Four groups, four topic cards, each group reads theirs and comes back with two things worth telling the room. Everyone leaves with the full resource sheet below to keep."
    >
      <RunningThisSession>
        Split into four groups, assign one card each (click a card below to claim it). ~10 minutes to read and discuss, ~10
        minutes to share back — one interesting thing, one question the group couldn&apos;t answer for the room to help
        with. No formal task, no marking. Print or share the resource sheet at the bottom afterwards — that&apos;s the
        actual takeaway.
      </RunningThisSession>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-bold text-ink">Pick a card, or click through all four yourself</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CARDS.map((c, i) => (
            <button
              key={c.title}
              type="button"
              onClick={() => setIdx(i)}
              className={`flex flex-col gap-1 rounded-[8px] border px-3.5 py-3 text-left ${i === idx ? "border-primary bg-card" : "border-border bg-transparent"}`}
            >
              <p className={`text-[9.5px] font-bold uppercase tracking-[0.06em] ${c.accent ? "text-destructive" : "text-muted"}`}>{c.tag}</p>
              <p className="text-[12.5px] font-semibold leading-tight text-ink">{c.title}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-[10px] border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-serif text-xl font-semibold text-ink">{active.title}</p>
          <p className="text-[10.5px] text-muted">Card {idx + 1} of 4</p>
        </div>
        <p className="text-xs leading-relaxed text-muted">{active.intro}</p>
        <div className="flex flex-col gap-2">
          {active.items.map((item) => (
            <div key={item.name} className="flex flex-col gap-0.5 rounded-[6px] bg-accent px-3.5 py-2.5">
              <p className="text-[12.5px] font-semibold text-ink">{item.name}</p>
              <p className="text-[11.5px] leading-snug text-muted">{item.note}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 border-t border-border pt-1">
          <p className="text-[11px] font-bold text-muted">Bring back to the room</p>
          <p className="text-xs text-ink">{active.prompt}</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + CARDS.length) % CARDS.length)}
            className="flex h-7 items-center rounded-full border border-border px-3.5 text-[11px] font-semibold text-ink"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % CARDS.length)}
            className="flex h-7 items-center rounded-full border border-border px-3.5 text-[11px] font-semibold text-ink"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-ink">Whole-group share-back · ~10 minutes</p>
        <div className="rounded-[8px] border border-border bg-card p-3.5">
          <p className="text-[13px] leading-relaxed text-ink">
            Each group: one thing worth telling the room, one question you couldn&apos;t answer. See if another group&apos;s card
            answers it.
          </p>
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">Take-away resource sheet — everything above, on one page</p>
        <p className="text-[11.5px] text-muted">Print this section, or scroll it on your own device. No login, no course-specific info — just links.</p>
      </div>

      {CARDS.map((c) => (
        <div key={c.title} className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-ink">{c.title}</p>
          {c.items.map((item) => (
            <div key={item.name} className="flex items-baseline gap-2.5 border-b border-border-faint py-2">
              <p className="min-w-[190px] text-[12.5px] font-semibold text-ink">{item.name}</p>
              <p className="flex-1 text-[11.5px] leading-snug text-muted">{item.note}</p>
            </div>
          ))}
        </div>
      ))}

      <div className="flex flex-col gap-1 rounded-[8px] border border-destructive/25 bg-destructive/5 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-destructive">A general caution, not specific to any site above</p>
        <p className="text-xs leading-relaxed text-ink">
          A legitimate school pays your salary — it never asks you to pay it for a job, a visa, or a &quot;placement fee&quot;
          upfront. Get any contract reviewed before signing, and don&apos;t hand over an original passport or degree
          certificate for someone else to hold — copies only, unless a consulate itself requires the original.
        </p>
      </div>

      <p className="text-center text-[10.5px] text-muted">
        This list points to third-party websites Connect doesn&apos;t control — check details directly with each one, rules
        and fees change.
      </p>
    </SessionShell>
  );
}
