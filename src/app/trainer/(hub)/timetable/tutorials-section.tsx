"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Avatar, toneForName } from "@/components/avatar";
import { createStage2Block, type FormState } from "@/app/trainer/(hub)/timetable/stage2-actions";
import { createConsultationBlock } from "@/app/trainer/(hub)/timetable/consultation-actions";
import { createOrUpdateIndividualTutorialInvite, cancelIndividualTutorialInvite } from "@/app/trainer/(hub)/timetable/individual-tutorial-actions";
import type { TutorialsSectionData, GridCell, CellKind, InviteAction, BlockSummary } from "@/lib/tutorials-section";

const initialState: FormState = { error: null };

// design_handoff_tutorials_consultations -- the colour vocabulary.
const TEAL_BAR = "oklch(45% 0.07 195)";
const GOLD_BAR = "oklch(63% 0.096 72)";
const KIND_STYLE: Record<CellKind, React.CSSProperties> = {
  booked: { background: "oklch(93% 0.019 190)", color: "oklch(32% 0.05 195)", borderColor: "transparent" },
  waiting: { background: "oklch(93% 0.05 80)", color: "oklch(40% 0.09 68)", borderColor: "transparent" },
  done: { background: "oklch(93.5% 0.008 85)", color: "oklch(38% 0.014 70)", borderColor: "transparent" },
  move: { background: "transparent", color: "var(--hub-accent)", borderColor: "var(--hub-accent)" },
  none: { background: "transparent", color: "var(--color-muted)", borderColor: "oklch(85% 0.012 82)", borderStyle: "dashed" },
};
const PILL = "inline-flex h-[26px] max-w-full items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-[12px] font-bold tabular-nums whitespace-nowrap";
const INPUT = "h-9 rounded-[8px] border border-border bg-card px-3 text-[13px] text-ink outline-none focus:border-primary";
const PRIMARY = "inline-flex h-[30px] items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-semibold text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60";
const OUTLINE = "inline-flex h-7 items-center rounded-[8px] border-[1.5px] px-3 text-[12px] font-bold";

function Pill({ kind, children, className = "" }: { kind: CellKind; children: React.ReactNode; className?: string }) {
  return (
    <span className={`${PILL} ${className}`} style={KIND_STYLE[kind]}>
      <span className="block size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function Segments({ booked, total, max }: { booked: number; total: number; max: number }) {
  const full = total > 0 && booked === total;
  return (
    <span className="flex gap-[3px]">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="block h-1.5 flex-1 rounded-full"
          style={{ maxWidth: max, background: i < booked ? (full ? TEAL_BAR : GOLD_BAR) : "oklch(0% 0 0 / 0.09)" }}
        />
      ))}
    </span>
  );
}

function fillKind(booked: number, total: number): CellKind {
  if (total > 0 && booked === total) return "booked";
  if (booked === 0) return "none";
  return "waiting";
}

function CountPill({ booked, total, word = "booked" }: { booked: number; total: number; word?: string }) {
  const kind = fillKind(booked, total);
  return (
    <span className={`${PILL} justify-self-end`} style={kind === "none" ? { ...KIND_STYLE.done, borderColor: "transparent" } : KIND_STYLE[kind]}>
      <span className="block size-1.5 rounded-full bg-current" />
      {booked} of {total} {word}
    </span>
  );
}

// ---------- forms ----------

function Stage2SheetForm({ groups, preselect, onDone }: { groups: { scope: string; name: string }[]; preselect: string | null; onDone: () => void }) {
  const [state, action, pending] = useActionState(createStage2Block, initialState);
  const [scope, setScope] = useState(preselect ?? groups[0]?.scope ?? "");
  return (
    <form action={action} className="mt-2 grid grid-cols-1 gap-2 rounded-[10px] border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <select name="scope" value={scope} onChange={(e) => setScope(e.target.value)} required aria-label="Group" className={INPUT}>
        {groups.map((g) => (
          <option key={g.scope} value={g.scope}>
            {g.name}
          </option>
        ))}
      </select>
      <input type="hidden" name="group_label" value={groups.find((g) => g.scope === scope)?.name ?? ""} />
      <input name="event_date" type="date" required aria-label="Date" className={INPUT} />
      <input name="event_time" type="time" required aria-label="Start time" className={INPUT} />
      <input name="duration_minutes" type="number" min={15} step={15} defaultValue={90} required aria-label="Duration in minutes" className={`${INPUT} w-24`} />
      <button type="submit" disabled={pending} className={PRIMARY} style={{ background: "var(--hub-accent)", height: 36 }}>
        {pending ? "Placing…" : "Place sheet"}
      </button>
      <p className="text-[11.5px] text-muted sm:col-span-4">Positions of 15 minutes, in order. One announcement goes to the group when the sheet is placed.</p>
      <button type="button" onClick={onDone} className="justify-self-end text-[12px] text-muted hover:text-ink">
        Close
      </button>
      {state.error ? <p className="text-[12px] text-destructive sm:col-span-5">{state.error}</p> : null}
    </form>
  );
}

function ConsultationBlockForm({ data, onDone }: { data: TutorialsSectionData; onDone: () => void }) {
  const [state, action, pending] = useActionState(createConsultationBlock, initialState);
  const canChoose = data.viewerRole !== "act";
  const [tutorId, setTutorId] = useState(data.viewerId);
  const tutorName = data.tutors.find((t) => t.id === tutorId)?.name ?? data.viewerName;
  return (
    <form action={action} className="mt-2 grid grid-cols-1 gap-2 rounded-[10px] border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      {canChoose ? (
        <select name="tutor_profile_id" value={tutorId} onChange={(e) => setTutorId(e.target.value)} aria-label="Tutor" className={INPUT}>
          {data.tutors.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="flex h-9 items-center text-[13px] text-ink">{data.viewerName}</span>
      )}
      <input type="hidden" name="tutor_name" value={tutorName} />
      <input name="event_date" type="date" required aria-label="Date" className={INPUT} />
      <input name="event_time" type="time" required aria-label="Start time" className={INPUT} />
      <input name="duration_minutes" type="number" min={15} step={15} defaultValue={60} required aria-label="Duration in minutes" className={`${INPUT} w-24`} />
      <button type="submit" disabled={pending} className={PRIMARY} style={{ background: "var(--hub-accent)", height: 36 }}>
        {pending ? "Adding…" : "Add block"}
      </button>
      <p className="text-[11.5px] text-muted sm:col-span-4">
        Any candidate may book before an assignment&apos;s first submission; after it, only with their own tutor. Connect applies that at booking.
      </p>
      <button type="button" onClick={onDone} className="justify-self-end text-[12px] text-muted hover:text-ink">
        Close
      </button>
      {state.error ? <p className="text-[12px] text-destructive sm:col-span-5">{state.error}</p> : null}
    </form>
  );
}

function InviteForm({ invite, onDone }: { invite: InviteAction; onDone: () => void }) {
  const [state, action, pending] = useActionState(createOrUpdateIndividualTutorialInvite, initialState);
  const label = invite.stage === "stage1" ? "Stage 1" : "Stage 3";
  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3 shadow-[0_8px_24px_oklch(30%_0.04_58_/_0.1)]" onClick={(e) => e.stopPropagation()}>
      <p className="text-[12px] text-muted">
        {invite.inviteId ? `Reschedule ${invite.traineeName}'s ${label} tutorial` : `Invite ${invite.traineeName} to a ${label} tutorial`} -- they confirm from their Today page.
      </p>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="stage" value={invite.stage} />
        <input type="hidden" name="trainee_id" value={invite.traineeId} />
        <input type="hidden" name="trainee_name" value={invite.traineeName} />
        <input name="event_date" type="date" required defaultValue={invite.date ?? undefined} aria-label="Date" className={INPUT} />
        <input name="event_time" type="time" required defaultValue={invite.time ?? undefined} aria-label="Time" className={INPUT} />
        <button type="submit" disabled={pending} className={PRIMARY} style={{ background: "var(--hub-accent)" }}>
          {pending ? "Saving…" : invite.inviteId ? "Reschedule" : "Invite"}
        </button>
        <button type="button" onClick={onDone} className="text-[12px] text-muted hover:text-ink">
          Close
        </button>
      </form>
      {invite.inviteId ? (
        <form action={cancelIndividualTutorialInvite}>
          <input type="hidden" name="invite_id" value={invite.inviteId} />
          <button type="submit" className="text-[12px] text-destructive hover:underline">
            Cancel this invite
          </button>
        </form>
      ) : null}
      {state.error ? <p className="text-[12px] text-destructive">{state.error}</p> : null}
    </div>
  );
}

// ---------- the section ----------

export function TutorialsSection({ data }: { data: TutorialsSectionData }) {
  const [stage, setStage] = useState<1 | 2 | 3>(data.currentStage);
  const [sheetForm, setSheetForm] = useState<{ open: boolean; preselect: string | null }>({ open: false, preselect: null });
  const [blockForm, setBlockForm] = useState(false);
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [openTutor, setOpenTutor] = useState<string | null>(null);

  const isMct = data.viewerRole !== "act";
  const ownGroups = data.groups.filter((g) => g.own || isMct);
  const stageDot: Record<1 | 2 | 3, string> = { 1: TEAL_BAR, 2: "var(--hub-accent)", 3: "oklch(0% 0 0 / 0.25)" };
  const stageSub: Record<1 | 2 | 3, string> = { 1: "invites, one to one", 2: "one sheet per group · 15-min positions", 3: "only for flagged candidates" };

  // MCT: one line per tutor; ACT: every block, theirs tinted.
  const byTutor = new Map<string, BlockSummary[]>();
  for (const b of data.blocks) byTutor.set(b.tutorId, [...(byTutor.get(b.tutorId) ?? []), b]);

  const legend: { kind: CellKind; label: string }[] = [
    { kind: "booked", label: "booked / confirmed" },
    { kind: "waiting", label: "waiting on the candidate" },
    { kind: "done", label: "done, on the CELTA 5" },
    { kind: "move", label: "your move" },
    { kind: "none", label: "nothing due" },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[760px] flex-col gap-1.5">
          <h2 className="font-serif text-[28px] leading-[1.1] font-semibold text-ink-warm">Tutorials and consultations</h2>
          <p className="text-[13.5px] leading-[1.5] text-muted">
            Where every candidate stands, one row each. A cell is the state and the door: click it to invite, open a sheet, or see the booking.{" "}
            {isMct ? "You see every group." : "You see every group; you can act on your own."}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {legend.map((l) => (
            <span key={l.kind} className={PILL} style={l.kind === "move" ? { background: "color-mix(in oklab, var(--hub-accent) 12%, var(--color-card))", color: "var(--hub-accent)", borderColor: "transparent" } : KIND_STYLE[l.kind]}>
              <span className="block size-1.5 rounded-full bg-current" />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Card 1 -- Tutorials (teal) */}
        <div
          className="flex flex-col gap-1.5 rounded-[14px] border px-5 pt-4 pb-2"
          style={{ background: `color-mix(in oklab, ${TEAL_BAR} 7%, var(--color-card))`, borderColor: `color-mix(in oklab, ${TEAL_BAR} 30%, transparent)` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[11.5px] font-bold tracking-[0.1em] uppercase" style={{ color: "oklch(32% 0.05 195)" }}>
                Tutorials
              </span>
              <span className="text-[12px] text-muted">{stageSub[stage]}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-[3px] rounded-[8px] bg-black/[0.06] p-[3px]" role="tablist">
                {([1, 2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="tab"
                    aria-selected={stage === n}
                    onClick={() => setStage(n)}
                    className={`flex h-6 items-center gap-[5px] rounded-[6px] px-2.5 text-[11.5px] font-bold whitespace-nowrap ${stage === n ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted"}`}
                  >
                    <span className="block size-1.5 rounded-full" style={{ background: stageDot[n] }} />
                    Stage {n}
                  </button>
                ))}
              </div>
              {stage === 2 && ownGroups.length > 0 ? (
                <button type="button" onClick={() => setSheetForm({ open: !sheetForm.open, preselect: null })} className={PRIMARY} style={{ background: "var(--hub-accent)" }}>
                  <span className="text-[15px] leading-none">+</span>Add sheet
                </button>
              ) : null}
            </div>
          </div>

          {data.groups.length === 0 ? <p className="py-2 text-[12.5px] text-muted">No TP groups set up yet.</p> : null}
          {data.groups.map((g) => (
            <div key={g.scope} className="grid grid-cols-[120px_1fr_150px] items-center gap-3.5 border-t border-border-faint py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={g.name} size="xs" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{g.name}</span>
                  {g.own && !isMct ? <span className="text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: "var(--hub-accent)" }}>Yours</span> : null}
                </div>
              </div>
              {stage === 1 ? (
                <>
                  <span className="text-[12.5px] text-ink/80">
                    {g.stage1.notInvited === g.stage1.total ? "No invites sent yet -- invite from the grid below" : `${g.stage1.total - g.stage1.notInvited} of ${g.stage1.total} invited`}
                  </span>
                  <span className={`${PILL} justify-self-end`} style={g.stage1.filed === g.stage1.total && g.stage1.total > 0 ? KIND_STYLE.done : g.stage1.pending > 0 ? KIND_STYLE.waiting : KIND_STYLE.done}>
                    <span className="block size-1.5 rounded-full bg-current" />
                    {g.stage1.filed} of {g.stage1.total} filed{g.stage1.pending > 0 ? ` · ${g.stage1.pending} pending` : ""}
                  </span>
                </>
              ) : stage === 2 ? (
                g.stage2 ? (
                  <>
                    <Link href={g.stage2.href} className="flex min-w-0 flex-col gap-[5px] hover:underline">
                      <span className="text-[12.5px] whitespace-nowrap text-ink/80 tabular-nums">{g.stage2.when}</span>
                      <Segments booked={g.stage2.booked} total={g.stage2.total} max={34} />
                    </Link>
                    <CountPill booked={g.stage2.booked} total={g.stage2.total} />
                  </>
                ) : (
                  <>
                    <span className="text-[12.5px] text-muted italic">No sheet placed yet</span>
                    {g.own || isMct ? (
                      <button
                        type="button"
                        onClick={() => setSheetForm({ open: true, preselect: g.scope })}
                        className={`${OUTLINE} justify-self-end trainer-hover-fill`}
                        style={{ borderColor: "var(--hub-accent)", color: "var(--hub-accent)" }}
                      >
                        Place sheet
                      </button>
                    ) : (
                      <span className="justify-self-end text-[12px] text-muted">view only</span>
                    )}
                  </>
                )
              ) : g.stage3.flagged.length === 0 ? (
                <>
                  <span className="text-[12.5px] text-muted">Nobody flagged</span>
                  <span className={`${PILL} justify-self-end`} style={KIND_STYLE.done}>
                    <span className="block size-1.5 rounded-full bg-current" />
                    nothing due
                  </span>
                </>
              ) : (
                <>
                  <span className="truncate text-[12.5px] text-ink/80">
                    {g.stage3.flagged.length} flagged · {g.stage3.flagged.map((f) => f.name).join(", ")}
                  </span>
                  <span className={`${PILL} justify-self-end`} style={g.stage3.flagged.every((f) => f.invited) ? KIND_STYLE.booked : KIND_STYLE.move}>
                    <span className="block size-1.5 rounded-full bg-current" />
                    {g.stage3.flagged.filter((f) => f.invited).length} of {g.stage3.flagged.length} invited
                  </span>
                </>
              )}
            </div>
          ))}
          {sheetForm.open ? (
            <Stage2SheetForm groups={ownGroups.map((g) => ({ scope: g.scope, name: g.name }))} preselect={sheetForm.preselect} onDone={() => setSheetForm({ open: false, preselect: null })} />
          ) : null}
        </div>

        {/* Card 2 -- Consultation blocks (gold) */}
        <div
          className="flex flex-col gap-1.5 rounded-[14px] border px-5 pt-4 pb-2"
          style={{ background: `color-mix(in oklab, ${GOLD_BAR} 10%, var(--color-card))`, borderColor: `color-mix(in oklab, ${GOLD_BAR} 40%, transparent)` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[11.5px] font-bold tracking-[0.1em] uppercase" style={{ color: "oklch(40% 0.09 68)" }}>
                Consultation blocks
              </span>
              <span className="text-[12px] text-muted">{isMct ? "one line per tutor · click to open their blocks" : "every tutor's blocks · yours highlighted · others view only"}</span>
            </div>
            <button type="button" onClick={() => setBlockForm((v) => !v)} className={PRIMARY} style={{ background: "var(--hub-accent)" }}>
              <span className="text-[15px] leading-none">+</span>Add block
            </button>
          </div>

          {data.blocks.length === 0 ? <p className="py-2 text-[12.5px] text-muted">No blocks yet.</p> : null}
          {isMct
            ? [...byTutor.entries()].map(([tutorId, blocks]) => {
                const booked = blocks.reduce((n, b) => n + b.booked, 0);
                const total = blocks.reduce((n, b) => n + b.total, 0);
                const open = openTutor === tutorId;
                return (
                  <div key={tutorId} className="border-t border-border-faint">
                    <button type="button" onClick={() => setOpenTutor(open ? null : tutorId)} className="grid w-full grid-cols-[150px_1fr_150px] items-center gap-3.5 py-2.5 text-left hover:bg-[color-mix(in_oklab,var(--hub-accent)_5%,transparent)]">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={blocks[0].tutorName} size="xs" />
                        <span className="truncate text-[13.5px] font-semibold text-ink">{blocks[0].tutorName}</span>
                      </span>
                      <span className="flex min-w-0 flex-col gap-[5px]">
                        <span className="text-[12.5px] text-ink/80">
                          {blocks.length} block{blocks.length === 1 ? "" : "s"} this course
                        </span>
                        <Segments booked={booked} total={total} max={22} />
                      </span>
                      <CountPill booked={booked} total={total} />
                    </button>
                    {open
                      ? blocks.map((b) => (
                          <Link key={b.id} href={b.href} className="grid grid-cols-[150px_1fr_150px] items-center gap-3.5 border-t border-border-faint py-2 pl-9 hover:bg-[color-mix(in_oklab,var(--hub-accent)_5%,transparent)]">
                            <span className="text-[12.5px] text-muted">Open sheet</span>
                            <span className="flex min-w-0 flex-col gap-[5px]">
                              <span className="text-[12.5px] whitespace-nowrap text-ink/80 tabular-nums">{b.when}</span>
                              <Segments booked={b.booked} total={b.total} max={34} />
                            </span>
                            <CountPill booked={b.booked} total={b.total} />
                          </Link>
                        ))
                      : null}
                  </div>
                );
              })
            : data.blocks.map((b) => (
                <Link
                  key={b.id}
                  href={b.href}
                  className="-mx-2 grid grid-cols-[120px_1fr_150px] items-center gap-3.5 rounded-[8px] border-t border-border-faint px-2 py-2.5 hover:bg-[color-mix(in_oklab,var(--hub-accent)_5%,transparent)]"
                  style={b.mine ? { background: "color-mix(in oklab, var(--hub-accent) 9%, transparent)", boxShadow: "inset 0 0 0 1.5px var(--hub-accent)" } : undefined}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={b.tutorName} size="xs" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13.5px] font-semibold text-ink">{b.tutorName}</span>
                      {b.mine ? <span className="text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: "var(--hub-accent)" }}>Yours</span> : null}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-[5px]">
                    <span className="text-[12.5px] whitespace-nowrap text-ink/80 tabular-nums">{b.when}</span>
                    <Segments booked={b.booked} total={b.total} max={34} />
                  </span>
                  <CountPill booked={b.booked} total={b.total} />
                </Link>
              ))}
          {blockForm ? <ConsultationBlockForm data={data} onDone={() => setBlockForm(false)} /> : null}
        </div>
      </div>

      {/* The candidate grid -- the section's one shadowed card. */}
      <div className="overflow-x-auto rounded-[14px] border border-border bg-card" style={{ boxShadow: "0 1px 2px oklch(0% 0 0 / 0.04), 0 8px 24px oklch(30% 0.04 58 / 0.06)" }}>
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[260px_repeat(4,minmax(0,1fr))] items-end gap-x-3 border-b border-border px-5 pt-3.5 pb-2.5 text-[10.5px] font-bold tracking-[0.08em] text-muted uppercase">
            <div>Candidate</div>
            <div>Stage 1</div>
            <div>Stage 2</div>
            <div>Stage 3</div>
            <div>Consultations</div>
          </div>
          {data.rows.length === 0 ? <p className="px-5 py-4 text-sm text-muted">No candidates on this course yet.</p> : null}
          {data.rows.map((r) => (
            <div
              key={r.id}
              className="grid min-h-[66px] grid-cols-[260px_repeat(4,minmax(0,1fr))] items-center gap-x-3 border-b border-[oklch(90%_0.012_82)] px-5 py-2.5 last:border-b-0"
              style={{ background: `color-mix(in oklab, ${toneForName(r.name)} 7%, var(--color-card))` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={r.name} size="sm" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/portfolio/${r.id}`} className="truncate text-[14px] font-semibold text-ink hover:text-[var(--hub-accent-deep)]">
                    {r.name}
                  </Link>
                  <span className="flex items-center gap-1.5 truncate text-[12px] text-muted">
                    {r.groupName} · {r.tutorName}
                    {r.own && !isMct ? (
                      <span className="rounded-full px-1.5 py-px text-[10px] font-bold tracking-[0.06em] uppercase" style={{ background: "color-mix(in oklab, var(--hub-accent) 14%, transparent)", color: "var(--hub-accent)" }}>
                        Yours
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
              {r.cells.map((c, i) => {
                const key = `${r.id}:${i}`;
                return <GridCellView key={key} cell={c} open={openCell === key} onToggle={() => setOpenCell(openCell === key ? null : key)} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GridCellView({ cell, open, onToggle }: { cell: GridCell; open: boolean; onToggle: () => void }) {
  const body = (
    <>
      <Pill kind={cell.kind}>{cell.main}</Pill>
      <span className="max-w-full truncate pl-0.5 text-[11.5px]" style={{ color: cell.kind === "move" && !cell.viewOnly ? "var(--hub-accent)" : "var(--color-muted)" }}>
        {cell.sub}
      </span>
    </>
  );
  const title = `${cell.main} — ${cell.sub}${cell.viewOnly ? " · view only" : ""}`;
  const box = "-mx-2 flex min-w-0 flex-col items-start gap-1 rounded-[10px] px-2 py-1.5 text-left";
  const hover = cell.viewOnly ? "" : "hover:bg-[color-mix(in_oklab,var(--hub-accent)_7%,transparent)] hover:shadow-[inset_0_0_0_1px_var(--hub-accent)]";

  if (cell.href && !cell.viewOnly) {
    return (
      <Link href={cell.href} title={title} className={`${box} ${hover}`}>
        {body}
      </Link>
    );
  }
  if (cell.action && !cell.viewOnly) {
    return (
      <div className="relative min-w-0">
        <button type="button" onClick={onToggle} title={title} className={`${box} ${hover} w-full`}>
          {body}
        </button>
        {open && cell.action.type === "invite" ? (
          <div className="absolute top-full left-0 z-20 w-[360px]">
            <InviteForm invite={cell.action} onDone={onToggle} />
          </div>
        ) : null}
        {open && cell.action.type === "place-sheet" ? (
          <div className="absolute top-full left-0 z-20 w-[560px]">
            <Stage2SheetForm groups={[{ scope: cell.action.scope, name: cell.action.label }]} preselect={cell.action.scope} onDone={onToggle} />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div title={title} className={box}>
      {body}
    </div>
  );
}
