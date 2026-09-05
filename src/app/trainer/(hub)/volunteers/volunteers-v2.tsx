"use client";

import { useActionState, useState } from "react";
import { PageHead, HUB_BUTTON, HUB_PRIMARY, HUB_PRIMARY_STYLE } from "@/app/trainer/(hub)/page-head";
import { RegisterLinkButton } from "@/app/trainer/(hub)/volunteers/register-link-button";
import {
  addVolunteerStudent,
  removeVolunteerStudent,
  saveVolunteerTranscript,
  reissueVolunteerLink,
  sendClassStartingEmails,
  sendVolunteerStartingEmailNow,
  type FormState,
  type ReissueState,
  type ShareClassState,
  type SendStartingEmailState,
} from "@/app/trainer/(hub)/volunteers/actions";
import { LEVEL_OPTIONS } from "@/lib/levels";
import { Avatar } from "@/components/avatar";

// design_handoff_volunteer_students_v2: the Today strip (RSVP replies +
// Zoom presence, nothing to enter), the register grouped by class, and the
// student card beside the list. Attendance is computed, never entered here.

export type TodayState = "in_room" | "coming" | "cant" | "not_joined_yet" | "no_reply";

export interface SessionMark {
  date: string;
  dayNumber: number;
  tier: "present" | "partial" | "absent";
  creditedMinutes: number;
  isToday: boolean;
  inRoomNow: boolean;
}

export interface VolunteerRowData {
  id: string;
  name: string;
  level: string | null;
  email: string | null;
  joinedAt: string;
  signupCompleted: boolean;
  token: string | null;
  lastOpenedAt: string | null;
  expiresAt: string | null;
  consentAt: string | null;
  transcript: string | null;
  sessions: SessionMark[];
  totalDays: number;
  hoursHere: number;
  hoursPrior: number;
  priorCourses: number;
  oneLessonCount: number;
  absentCount: number;
  todayState: TodayState | null;
  saidComing: boolean;
  saidCant: boolean;
}

export interface ClassLabel {
  level: string | null;
  label: string;
}

export interface TodayInfo {
  dateLabel: string;
  classNumber: number;
  totalClasses: number;
  startTime: string | null;
  underway: boolean;
  lessonsToday: number;
}

export interface RuleInfo {
  need: number;
  lessons: number;
  sessionHours: number;
  target: number;
}

const TEAL = "oklch(38% 0.072 195)";
const TEAL_TINT = "oklch(92% 0.028 190)";
const GOLD_BAR = "oklch(63% 0.096 72)";
const AMBER = "oklch(44% 0.095 68)";
const RED = "oklch(45% 0.16 27)";
const INK = "var(--color-ink)";
const initialForm: FormState = { error: null };

/** 2.25 → "2¼", 1.5 → "1½" -- the design writes session lengths as fractions. */
export function fractionHours(h: number): string {
  const whole = Math.floor(h);
  const frac = Math.round((h - whole) * 4);
  const part = ["", "¼", "½", "¾"][frac] ?? "";
  if (frac === 4) return String(whole + 1);
  return whole === 0 ? part || "0" : `${whole}${part}`;
}

function milestonesFor(threshold: number): number[] {
  const step = Math.max(Math.round(threshold / 4 / 10) * 10, 1);
  return [...new Set([step, step * 2, step * 3, threshold])].sort((a, b) => a - b);
}

function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

function stampLabel(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `Today, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep");
}

// ---------- segments ----------

function markStyle(m: SessionMark): React.CSSProperties {
  if (m.isToday) {
    return m.inRoomNow
      ? { background: `color-mix(in oklab, ${TEAL} 30%, transparent)`, border: `1px solid ${TEAL}` }
      : { border: `1.5px dashed ${TEAL}`, background: "transparent" };
  }
  if (m.tier === "present") return { background: INK };
  if (m.tier === "partial") return { background: `linear-gradient(to top, ${INK} 50%, transparent 50%)`, border: `1px solid ${INK}` };
  return { background: "oklch(94% 0.043 25 / 0.6)", border: `1px solid ${RED}` };
}

function markTitle(m: SessionMark, sessionHours: number): string {
  const state = m.isToday
    ? m.inRoomNow
      ? "in the room now"
      : "today, in progress"
    : m.tier === "present"
      ? "present"
      : m.tier === "partial"
        ? "one lesson"
        : "absent";
  return `Class ${m.dayNumber} · ${shortDay(m.date)} · ${state}`;
}

function Segments({ row, size = 16, sessionHours }: { row: VolunteerRowData; size?: number; sessionHours: number }) {
  const held = row.sessions;
  const upcoming = Math.max(0, row.totalDays - held.length);
  return (
    <span className="flex flex-wrap gap-[3px]">
      {held.map((m) => (
        <span key={m.date} title={markTitle(m, sessionHours)} className="block w-[13px] rounded-[3px]" style={{ height: size, ...markStyle(m) }} />
      ))}
      {Array.from({ length: upcoming }, (_, i) => (
        <span key={`u${i}`} title="Upcoming" className="block w-[13px] rounded-[3px] bg-black/[0.07]" style={{ height: size }} />
      ))}
    </span>
  );
}

// ---------- today strip chips ----------

const CHIP: Record<TodayState, { style: React.CSSProperties; ring: React.ReactNode; tag: string; tagColor: string }> = {
  in_room: {
    style: { background: `color-mix(in oklab, ${TEAL} 14%, var(--color-card))`, borderColor: TEAL },
    ring: <span className="flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold text-primary-foreground" style={{ background: TEAL }}>✓</span>,
    tag: "in the room",
    tagColor: TEAL,
  },
  coming: {
    style: { background: "var(--color-card)", borderColor: "var(--color-border)" },
    ring: <span className="flex size-3.5 items-center justify-center rounded-full" style={{ background: `color-mix(in oklab, ${TEAL} 30%, transparent)` }}><span className="block size-1.5 rounded-full" style={{ background: TEAL }} /></span>,
    tag: "coming",
    tagColor: TEAL,
  },
  cant: {
    style: { background: "var(--color-card)", borderColor: `color-mix(in oklab, ${RED} 45%, transparent)` },
    ring: <span className="flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: "oklch(94% 0.043 25)", color: RED }}>—</span>,
    tag: "can't come",
    tagColor: RED,
  },
  not_joined_yet: {
    style: { background: "oklch(94% 0.043 25 / 0.4)", borderColor: "var(--color-border)" },
    ring: <span className="block size-3.5 rounded-full border-[1.5px]" style={{ borderColor: RED }} />,
    tag: "not joined yet",
    tagColor: RED,
  },
  no_reply: {
    style: { background: `color-mix(in oklab, ${GOLD_BAR} 10%, var(--color-card))`, borderColor: `color-mix(in oklab, ${GOLD_BAR} 60%, transparent)` },
    ring: <span className="block size-3.5 rounded-full border-[1.5px]" style={{ borderColor: AMBER }} />,
    tag: "no reply",
    tagColor: AMBER,
  },
};

// ---------- forms ----------

function AddRow({ classes, onDone }: { classes: ClassLabel[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(addVolunteerStudent, initialForm);
  const input = "h-9 rounded-[8px] border border-border bg-card px-3 text-[13px] text-ink outline-none focus:border-primary";
  const known = new Set(classes.map((c) => c.level).filter(Boolean));
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-[10px] border bg-card p-3.5" style={{ borderColor: TEAL }}>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted">Name</label>
        <input name="name" type="text" required className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted">Class</label>
        <select name="level" defaultValue="" className={input}>
          <option value="">Not set</option>
          {[...known, ...LEVEL_OPTIONS.filter((l) => !known.has(l))].map((l) => (
            <option key={l as string} value={l as string}>
              {l as string}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label className="text-[11px] font-semibold text-muted">Email</label>
        <input name="email" type="email" className={input} />
        <span className="text-[10.5px] text-muted">matches them to hours already on file</span>
      </div>
      <button type="submit" disabled={pending} className={HUB_PRIMARY} style={HUB_PRIMARY_STYLE}>
        {pending ? "Adding…" : "Add and send link"}
      </button>
      <button type="button" onClick={onDone} className="text-[12px] text-muted hover:text-ink">
        Cancel
      </button>
      {state.error ? <p className="w-full text-[12px] text-destructive">{state.error}</p> : null}
    </form>
  );
}

function ShareClassButton({ level }: { level: string | null }) {
  const [state, action, pending] = useActionState(sendClassStartingEmails, { error: null, sentCount: null } as ShareClassState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="level" value={level ?? ""} />
      {/* Ramy, 5 Sep 2026: "Share with class" read like sharing materials
          -- the button delivers each student their own Connect link. */}
      <button type="submit" disabled={pending} title="Emails every student in this class their own Connect link" className="text-[11px] font-semibold hover:underline" style={{ color: TEAL }}>
        {pending ? "Sending…" : state.sentCount !== null ? `Emailed ${state.sentCount}` : "Email everyone their link"}
      </button>
      {state.error ? <span className="text-[11px] text-destructive">{state.error}</span> : null}
    </form>
  );
}

function CopyButton({ url, small = false }: { url: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={small ? "text-[11px] font-medium hover:underline" : "trainer-hover-fill h-7 rounded-[6px] border border-border bg-card px-2.5 text-[12px] font-semibold text-ink"}
      style={small ? { color: TEAL } : undefined}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ---------- the page ----------

export function VolunteersV2({
  rows,
  classes,
  todayInfo,
  rule,
  courseEndDate,
  siteOrigin,
}: {
  rows: VolunteerRowData[];
  classes: ClassLabel[];
  todayInfo: TodayInfo | null;
  rule: RuleInfo;
  courseEndDate: string | null;
  siteOrigin: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const byClass = classes.map((c) => ({ ...c, members: rows.filter((r) => (r.level ?? null) === c.level) })).filter((c) => c.members.length > 0);
  const coming = rows.filter((r) => r.saidComing).length;
  const cant = rows.filter((r) => r.saidCant).length;
  const inRoom = rows.filter((r) => r.todayState === "in_room").length;
  const noReply = rows.length - coming - cant;
  const hoursLabel = fractionHours(rule.sessionHours);

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead
        eyebrow={`Volunteers · ${rows.length} student${rows.length === 1 ? "" : "s"} · ${byClass.length} class${byClass.length === 1 ? "" : "es"}`}
        title="Volunteer students"
        lede={`Each student has a no-login link to their materials and hours. Present means ${rule.need} of a session's ${rule.lessons} lessons and banks the whole ${hoursLabel} h; certificate at ${rule.target} h across all courses.`}
      >
        <a href="/api/filming-consent.pdf" className={HUB_BUTTON}>
          Filming consent form
        </a>
        <RegisterLinkButton />
        <button type="button" onClick={() => setAddOpen((v) => !v)} className={HUB_PRIMARY} style={HUB_PRIMARY_STYLE}>
          {addOpen ? "Cancel" : "Add student"}
        </button>
      </PageHead>

      {addOpen ? <AddRow classes={classes} onDone={() => setAddOpen(false)} /> : null}

      {todayInfo ? (
        <div className="sheet flex flex-col gap-1 !p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-faint px-5 py-3">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: TEAL }}>
                Today
              </span>
              <span className="text-[13px] font-semibold text-ink">
                {todayInfo.dateLabel} · Class {todayInfo.classNumber} of {todayInfo.totalClasses}
              </span>
              <span className="text-[12px] text-muted">Replies come from the confirmation email; presence is logged from Zoom by the timetable. Nothing to enter here.</span>
            </div>
            <span className="text-[12px] font-semibold text-ink tabular-nums">
              {coming} of {rows.length} said coming · {cant} can&apos;t · {noReply} no reply{todayInfo.underway ? ` · ${inRoom} in the room` : ""}
            </span>
          </div>
          {byClass.map((c) => {
            const cComing = c.members.filter((r) => r.saidComing).length;
            const cCant = c.members.filter((r) => r.saidCant).length;
            const cInRoom = c.members.filter((r) => r.todayState === "in_room").length;
            const cNoReply = c.members.length - cComing - cCant;
            return (
              <div key={c.label} className="grid grid-cols-1 items-center gap-3 border-b border-border-faint px-5 py-3 last:border-b-0 lg:grid-cols-[280px_1fr_auto]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-ink">{c.label}</span>
                  {todayInfo.startTime ? (
                    <span className="text-[11px] text-muted">
                      {todayInfo.startTime} · Class {todayInfo.classNumber}
                    </span>
                  ) : null}
                  <span className="text-[12px] font-semibold text-ink">
                    {todayInfo.underway ? `${cInRoom} in the room · ${cComing} said they were coming` : `${cComing} coming · ${cCant} can't · ${cNoReply} no reply`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.members.map((r) => {
                    const chip = CHIP[r.todayState ?? "no_reply"];
                    return (
                      <span key={r.id} title={`${r.name} — ${chip.tag}`} className="inline-flex h-[30px] items-center gap-1.5 rounded-full border px-2.5" style={chip.style}>
                        {chip.ring}
                        <span className={`text-[12.5px] font-medium ${r.todayState === "cant" ? "text-muted" : "text-ink"}`}>{r.name}</span>
                        <span className="text-[10px] font-semibold" style={{ color: chip.tagColor }}>
                          {chip.tag}
                        </span>
                      </span>
                    );
                  })}
                </div>
                <span className="text-[11px] whitespace-nowrap text-muted">
                  {todayInfo.underway
                    ? `Underway · present at ${rule.need} of ${todayInfo.lessonsToday} lesson${todayInfo.lessonsToday === 1 ? "" : "s"}`
                    : todayInfo.startTime
                      ? `Starts ${todayInfo.startTime} · nothing logged yet`
                      : "Nothing logged yet"}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-4">
          {byClass.length === 0 ? <div className="sheet p-6 text-sm text-muted">No volunteer students added yet.</div> : null}
          {byClass.map((c) => {
            const drifting = c.members.filter((r) => r.oneLessonCount >= 2 || r.absentCount >= 2).length;
            const neverOpened = c.members.filter((r) => !r.lastOpenedAt).length;
            const meta = [
              `${c.members.length} student${c.members.length === 1 ? "" : "s"}`,
              todayInfo?.startTime ? `today ${todayInfo.startTime}` : null,
              drifting > 0 ? `${drifting} drifting` : null,
              neverOpened > 0 ? `${neverOpened} never opened link` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={c.label} className="sheet overflow-hidden !p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-card-inset px-4 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <span className="text-[13px] font-bold text-ink">{c.label}</span>
                    <span className="text-[11.5px] text-muted">{meta}</span>
                  </div>
                  <ShareClassButton level={c.level} />
                </div>
                <div className="grid grid-cols-[minmax(0,1.2fr)_196px_150px_112px_44px] items-end gap-x-3.5 border-b border-border px-4 pt-2.5 pb-1.5 text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
                  <span>Student</span>
                  <span>This course · {rows[0]?.totalDays ?? 12} classes</span>
                  <span>Hours banked · of {rule.target}</span>
                  <span>Link</span>
                  <span />
                </div>
                {c.members.map((r) => {
                  const isSelected = r.id === selectedId;
                  const drift = r.oneLessonCount >= 2 ? { color: AMBER, text: `${r.oneLessonCount} one-lesson marks — leaving early` } : r.absentCount >= 2 ? { color: RED, text: `${r.absentCount} absences` } : null;
                  const milestones = milestonesFor(rule.target);
                  const totalHours = r.hoursPrior + r.hoursHere;
                  const nextMilestone = milestones.find((m) => totalHours < m);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="grid w-full grid-cols-[minmax(0,1.2fr)_196px_150px_112px_44px] items-center gap-x-3.5 border-b border-border-faint px-4 py-[11px] text-left transition-colors last:border-b-0 hover:bg-[color-mix(in_oklab,var(--hub-hover-accent)_7%,transparent)]"
                      style={isSelected ? { background: `color-mix(in oklab, ${TEAL_TINT} 45%, var(--color-card))`, boxShadow: `inset 3px 0 0 ${TEAL}` } : undefined}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={r.name} size="xs" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] font-medium text-ink">{r.name}</span>
                          {drift ? (
                            <span className="truncate text-[11px]" style={{ color: drift.color }}>
                              {drift.text}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <Segments row={r} sessionHours={rule.sessionHours} />
                      <span className="flex flex-col gap-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-[13px] font-bold text-ink tabular-nums">{totalHours % 1 === 0 ? totalHours : totalHours.toFixed(2)} h</span>
                          <span className="text-[10px] text-muted">
                            {nextMilestone ? `${(nextMilestone - totalHours) % 1 === 0 ? nextMilestone - totalHours : (nextMilestone - totalHours).toFixed(2)} h to ${nextMilestone}` : "Certificate earned"}
                          </span>
                        </span>
                        <span className="h-1 w-full overflow-hidden rounded-full bg-black/[0.08]">
                          <span className="block h-1 rounded-full" style={{ width: `${Math.min(100, (totalHours / rule.target) * 100)}%`, background: GOLD_BAR }} />
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[12px]" style={{ color: r.lastOpenedAt ? TEAL : AMBER }}>
                        <span className="block size-1.5 rounded-full bg-current" />
                        {r.lastOpenedAt ? `Opened ${stampLabel(r.lastOpenedAt).toLowerCase()}` : "Never opened"}
                      </span>
                      <span onClick={(e) => e.stopPropagation()}>{r.token ? <CopyButton small url={`${siteOrigin}/student/${r.token}`} /> : null}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {byClass.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted">
              <span className="flex flex-wrap items-center gap-3.5">
                <span className="flex items-center gap-1.5"><span className="block h-3 w-[13px] rounded-[3px]" style={{ background: INK }} /> Present · {hoursLabel} h banked</span>
                <span className="flex items-center gap-1.5"><span className="block h-3 w-[13px] rounded-[3px] border border-ink" style={{ background: `linear-gradient(to top, ${INK} 50%, transparent 50%)` }} /> One lesson · recorded, nothing banked</span>
                <span className="flex items-center gap-1.5"><span className="block h-3 w-[13px] rounded-[3px] border" style={{ background: "oklch(94% 0.043 25 / 0.6)", borderColor: RED }} /> Absent</span>
                <span className="flex items-center gap-1.5"><span className="block h-3 w-[13px] rounded-[3px] border-[1.5px] border-dashed" style={{ borderColor: TEAL }} /> Today, in progress</span>
                <span className="flex items-center gap-1.5"><span className="block h-3 w-[13px] rounded-[3px] bg-black/[0.07]" /> Upcoming</span>
              </span>
              <span>presence logged from Zoom by the timetable; face-to-face sessions are ticked by the tutor on the event</span>
            </div>
          ) : null}
        </div>

        {selected ? <StudentCard key={selected.id} row={selected} rule={rule} courseEndDate={courseEndDate} siteOrigin={siteOrigin} /> : null}
      </div>
    </div>
  );
}

// ---------- the student card ----------

function StudentCard({ row, rule, courseEndDate, siteOrigin }: { row: VolunteerRowData; rule: RuleInfo; courseEndDate: string | null; siteOrigin: string }) {
  const [reissueState, reissueAction, reissuing] = useActionState(reissueVolunteerLink, { error: null, done: false } as ReissueState);
  const [emailState, emailAction, emailing] = useActionState(sendVolunteerStartingEmailNow, { error: null, sent: false } as SendStartingEmailState);
  const total = row.hoursPrior + row.hoursHere;
  const milestones = milestonesFor(rule.target);
  const nextMilestone = milestones.find((m) => total < m);
  const gap = nextMilestone ? nextMilestone - total : 0;
  const classesToGo = nextMilestone ? Math.ceil(gap / rule.sessionHours) : 0;
  const url = row.token ? `${siteOrigin}/student/${row.token}` : null;
  const held = [...row.sessions].reverse();
  const presentN = row.sessions.filter((s) => !s.isToday && s.tier === "present").length;
  const partialN = row.sessions.filter((s) => !s.isToday && s.tier === "partial").length;
  const absentN = row.sessions.filter((s) => !s.isToday && s.tier === "absent").length;
  const toCome = Math.max(0, row.totalDays - row.sessions.length);
  const hoursLabel = fractionHours(rule.sessionHours);
  const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2));

  return (
    <div className="sheet sticky top-6 flex flex-col gap-4 !p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="md" />
          <div className="flex flex-col gap-0.5">
            <span className="font-serif text-[20px] leading-tight font-semibold text-ink-warm">{row.name}</span>
            <span className="text-[11px] text-muted">
              {[row.level, `joined ${shortDay(row.joinedAt)}`, row.email].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
        <form
          action={removeVolunteerStudent}
          onSubmit={(e) => {
            if (!confirm(`Remove ${row.name}? Their attendance record stays; their link stops working.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="volunteer_id" value={row.id} />
          <button type="submit" className="h-[30px] rounded-[6px] border px-3 text-[12px] font-semibold" style={{ borderColor: `color-mix(in oklab, ${RED} 30%, transparent)`, color: RED }}>
            Remove
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2 rounded-[10px] border px-4 py-3.5" style={{ background: `color-mix(in oklab, ${GOLD_BAR} 9%, var(--color-card))`, borderColor: `color-mix(in oklab, ${GOLD_BAR} 30%, transparent)` }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color: AMBER }}>
            Hours toward certificate
          </span>
          <span className="text-[18px] font-bold text-ink tabular-nums">
            {fmt(total)} h of {rule.target}
          </span>
        </div>
        <span className="relative block h-1.5 overflow-hidden rounded-full bg-card">
          <span className="absolute inset-y-0 left-0 block rounded-full" style={{ width: `${Math.min(100, (total / rule.target) * 100)}%`, background: GOLD_BAR }} />
        </span>
        <span className="flex justify-between text-[9.5px] text-muted tabular-nums">
          <span>0</span>
          {milestones.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </span>
        <p className="text-[12px] leading-[1.5]" style={{ color: AMBER }}>
          {nextMilestone
            ? `${fmt(row.hoursPrior)} h from ${row.priorCourses} earlier course${row.priorCourses === 1 ? "" : "s"} + ${fmt(row.hoursHere)} h here. ${fmt(gap)} h to the ${nextMilestone}-hour ${nextMilestone === rule.target ? "certificate" : "milestone"} — ${classesToGo} more class${classesToGo === 1 ? "" : "es"}.`
            : "Certificate earned. Hours keep accruing on the record."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[10.5px] font-bold tracking-[0.1em] text-muted uppercase">This course</span>
          <span className="text-[12px] font-semibold text-ink tabular-nums">
            {presentN} present · {partialN} one-lesson · {absentN} absent · {toCome} to come
          </span>
        </div>
        <Segments row={row} size={22} sessionHours={rule.sessionHours} />
        <div className="flex flex-col">
          {held.map((s) => (
            <div key={s.date} className="grid grid-cols-[16px_1fr_auto_auto] items-center gap-2.5 border-t border-border-faint py-2 text-[12px]">
              <span className="block h-4 w-4 rounded-[3px]" style={markStyle(s)} />
              <span className="text-ink">Class {s.dayNumber}</span>
              <span
                className="text-[11px]"
                style={{
                  color: s.isToday
                    ? s.inRoomNow
                      ? TEAL
                      : row.saidCant
                        ? RED
                        : "var(--color-muted)"
                    : s.tier === "partial"
                      ? AMBER
                      : s.tier === "absent"
                        ? RED
                        : "var(--color-muted)",
                }}
              >
                {s.isToday
                  ? s.inRoomNow
                    ? "In the room now"
                    : row.saidComing
                      ? "Said coming"
                      : row.saidCant
                        ? "Said can't come"
                        : "No reply"
                  : s.tier === "present"
                    ? `Present · +${hoursLabel} h`
                    : s.tier === "partial"
                      ? "One lesson · nothing banked"
                      : "Absent"}
              </span>
              <span className="text-[11px] text-muted">{shortDay(s.date)}</span>
            </div>
          ))}
          {held.length === 0 ? <p className="py-2 text-[12px] text-muted">No classes held yet.</p> : null}
        </div>
        <p className="text-[10.5px] leading-[1.5] text-muted">
          Presence is Zoom join-to-leave time, summed across rejoins. Handouts appear on the student&apos;s link when the lesson is marked taught, attended or not.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-faint pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-bold tracking-[0.1em] text-muted uppercase">Their link</span>
          <span className="flex items-center gap-2">
            {url ? <CopyButton url={url} /> : null}
            {row.email && url ? (
              <form action={emailAction}>
                <input type="hidden" name="volunteer_id" value={row.id} />
                <button type="submit" disabled={emailing} className="trainer-hover-fill h-7 rounded-[6px] border border-border bg-card px-2.5 text-[12px] font-semibold text-ink disabled:opacity-60">
                  {emailing ? "Sending…" : emailState.sent ? "Sent!" : "Email it"}
                </button>
              </form>
            ) : null}
            <form
              action={reissueAction}
              onSubmit={(e) => {
                if (!confirm("Re-issue the link? The old one stops working; attendance and hours are untouched.")) e.preventDefault();
              }}
            >
              <input type="hidden" name="volunteer_id" value={row.id} />
              <button type="submit" disabled={reissuing} className="trainer-hover-fill h-7 rounded-[6px] border border-border bg-card px-2.5 text-[12px] font-semibold text-ink disabled:opacity-60">
                {reissuing ? "Re-issuing…" : "Re-issue"}
              </button>
            </form>
          </span>
        </div>
        {reissueState.error ? <p className="text-[11px] text-destructive">{reissueState.error}</p> : null}
        {emailState.error ? <p className="text-[11px] text-destructive">{emailState.error}</p> : null}
        {url ? <p className="truncate rounded-[6px] border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted">{url}</p> : <p className="text-[11px] text-destructive">No link on file — re-issue one.</p>}
        <div className="grid grid-cols-[1fr_auto] gap-y-1 text-[11.5px]">
          {row.todayState ? (
            <>
              <span className="text-muted">Today&apos;s reply</span>
              <span className="text-right font-semibold" style={{ color: row.saidCant ? RED : row.saidComing ? "var(--color-ink)" : AMBER }}>
                {row.saidComing ? "Coming" : row.saidCant ? "Can't come" : "No reply to confirmation"}
              </span>
            </>
          ) : null}
          <span className="text-muted">Last opened</span>
          <span className="text-right font-semibold text-ink">{stampLabel(row.lastOpenedAt)}</span>
          <span className="text-muted">Recording consent</span>
          <span className="text-right font-semibold" style={{ color: row.consentAt ? "var(--color-ink)" : AMBER }}>
            {row.consentAt ? stampLabel(row.consentAt) : "Not yet"}
          </span>
          <span className="text-muted">Expires</span>
          <span className="text-right font-semibold text-ink">{courseEndDate ? `${shortDay(courseEndDate)} (course end)` : "Course end"}</span>
        </div>
        {!row.lastOpenedAt && url ? (
          <p className="rounded-[6px] px-2.5 py-2 text-[11px]" style={{ background: `color-mix(in oklab, ${GOLD_BAR} 10%, var(--color-card))`, color: AMBER }}>
            Never opened — the link probably didn&apos;t arrive. Re-issue and hand it over in class.
          </p>
        ) : null}
        {row.signupCompleted && !row.transcript ? (
          <form action={saveVolunteerTranscript} className="flex items-end gap-2 border-t border-border-faint pt-2">
            <input type="hidden" name="volunteer_id" value={row.id} />
            <textarea
              name="transcript"
              required
              rows={1}
              placeholder="No transcript yet — listen to their recording and paste one here (for Focus on the Learner)"
              className="w-full flex-1 rounded-[6px] border border-border bg-card px-2 py-1 text-[11px] text-ink outline-none focus:border-primary"
            />
            <button type="submit" className="trainer-hover-fill shrink-0 rounded-[6px] border border-border px-2 py-1 text-[11px] text-ink">
              Save
            </button>
          </form>
        ) : null}
        {row.transcript ? <p className="text-[10.5px] text-muted">Transcript on file (for Focus on the Learner).</p> : null}
      </div>

      <p className="border-t border-border-faint pt-2.5 text-[10.5px] leading-[1.5] text-muted">
        Students see their own hours and a plain count of classes — no percentage, no threshold. They never see lesson plans, tutor feedback, grades, other students, or the portfolio.
      </p>
    </div>
  );
}
