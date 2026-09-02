import { requireRole } from "@/lib/auth/require-role";
import { getPlatformOwnerGreeting } from "@/lib/platform-owner-greeting";
import { checkPlatformHealth } from "@/lib/platform-health";
import { getPulseStripStats } from "@/app/platform/command-center/pulse-strip-data";
import { PulseStrip } from "@/app/platform/command-center/pulse-strip";
import { ProductSwitcher } from "@/app/platform/command-center/product-switcher";
import { CreateMenu } from "@/app/platform/command-center/create-menu";
import { SectionPills } from "@/app/platform/command-center/section-pills";

// Each section is its own route under this layout (Overview = this segment's
// own page.tsx, plus /people, /money, /access) so each fetches only the data
// it needs. The shell they share was a dark bar over a 220px sidebar until
// 2 Sep 2026, when Ramy redesigned it: "this whole black header dark header
// command center thing, it's just really not me... instead of one dark thing,
// just nice lines representing all the lines that we have."
//
// So: a rule, the identity and menus, a rule, the four section pills, a rule.
// The sidebar went with it -- it held only those four links and the greeting,
// which the pills now carry and the page now heads. His own question: "if I
// have Overview, People, Money, Access on top, why do I need the side panel
// with the same stuff?"
const GOLD = "oklch(0.62 0.14 68)";
const RED = "oklch(0.58 0.16 25)";
const GREEN = "oklch(0.7 0.13 155)";
const SAND = "oklch(0.935 0.012 82)";
const BORDER = "oklch(0.895 0.012 82)";
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";

export default async function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("platform_owner");
  const [greeting, health, pulseStats] = await Promise.all([
    getPlatformOwnerGreeting(profile.full_name),
    checkPlatformHealth(),
    getPulseStripStats(profile.id),
  ]);

  return (
    <div style={{ fontFamily: "Karla, Helvetica, sans-serif", background: SAND, minHeight: "100vh" }}>
      <div style={{ height: 3, background: GOLD }} />
      <div style={{ background: SAND, padding: "16px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <svg width="20" height="12" viewBox="8 30 104 60" fill="none">
              <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8" stroke={INK} strokeWidth="12" strokeLinecap="round" />
              <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8" stroke="oklch(99% 0.004 85)" strokeWidth="12" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic", fontSize: 19, color: INK }}>Connect</div>
          <div style={{ width: 1, height: 18, background: BORDER }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>Command center</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className="cc-pulse-dot"
              style={{ width: 7, height: 7, borderRadius: "50%", background: health.status === "normal" ? GREEN : health.status === "degraded" ? GOLD : RED }}
            />
            <span style={{ fontSize: 12, color: MUTED }}>{health.label}</span>
          </div>
          <ProductSwitcher />
          <CreateMenu />
        </div>
      </div>

      <style>{`
        @keyframes cc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .cc-pulse-dot { animation: cc-pulse 2.4s ease-in-out infinite; }
      `}</style>

      <SectionPills />

      <div style={{ padding: "26px 40px 20px", display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        {/* The greeting was the sidebar's only other job, so it becomes the
            page's own heading rather than disappearing with it. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontFamily: "Newsreader, serif", fontSize: 23, fontWeight: 600, color: INK }}>
            Welcome back, {greeting.firstName}
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>{greeting.dateEyebrow}</div>
        </div>

        <PulseStrip stats={pulseStats} />
        {children}
      </div>

      {/* Ramy, 2 Sep 2026: "I don't need my credit to be there. It's my
          command center. I built it. At least put it at the bottom or
          something. Doesn't have to be in my face." */}
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 40px", display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic", fontSize: 11.5, color: "oklch(64% 0.014 72)" }}>
          designed and built by Ramy
        </span>
      </div>
    </div>
  );
}
