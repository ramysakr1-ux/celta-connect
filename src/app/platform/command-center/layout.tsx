import { requireRole } from "@/lib/auth/require-role";
import { getPlatformOwnerGreeting } from "@/lib/platform-owner-greeting";
import { checkPlatformHealth } from "@/lib/platform-health";
import { getPulseStripStats } from "@/app/platform/command-center/pulse-strip-data";
import { PulseStrip } from "@/app/platform/command-center/pulse-strip";
import { ProductSwitcher } from "@/app/platform/command-center/product-switcher";
import { CreateMenu } from "@/app/platform/command-center/create-menu";
import { SidebarNav } from "@/app/platform/command-center/sidebar-nav";

// command-center-full-spec.md: sidebar-nav layout, rebuilt from the earlier
// single-page dashboard. Header + sidebar live here (one shell every
// section shares); each section is its own route under this layout
// (Overview = this segment's own page.tsx, plus /people, /money, /access)
// so each can fetch only the data it actually needs instead of one page
// loading all four sections' queries on every visit.
const DARK = "oklch(0.14 0.012 60)";
const GOLD = "oklch(0.62 0.14 68)";
const CREAM = "oklch(0.92 0.01 85)";
const RED = "oklch(0.58 0.16 25)";
const GREEN = "oklch(0.7 0.13 155)";
const SAND = "oklch(0.935 0.012 82)";
const PARCHMENT = "oklch(0.97 0.008 85)";
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
      <div style={{ background: DARK, padding: "22px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${GOLD}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <svg width="20" height="12" viewBox="8 30 104 60" fill="none">
              <path d="M56.1 42.2 A 24 24 0 1 0 56.1 77.8" stroke={DARK} strokeWidth="12" strokeLinecap="round" />
              <path d="M96.1 42.2 A 24 24 0 1 0 96.1 77.8" stroke={CREAM} strokeWidth="12" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontFamily: "Newsreader, Georgia, serif", fontStyle: "italic", fontSize: 19, color: CREAM }}>Connect</div>
          <div style={{ width: 1, height: 18, background: "oklch(0.32 0.02 60)" }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>Command center</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className="cc-pulse-dot"
              style={{ width: 7, height: 7, borderRadius: "50%", background: health.status === "normal" ? GREEN : health.status === "degraded" ? GOLD : RED }}
            />
            <span style={{ fontSize: 12, color: "oklch(0.7 0.02 75)" }}>{health.label}</span>
          </div>
          <ProductSwitcher />
          <CreateMenu />
        </div>
      </div>

      <style>{`
        @keyframes cc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .cc-pulse-dot { animation: cc-pulse 2.4s ease-in-out infinite; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", alignItems: "start", minHeight: "calc(100vh - 66px)" }}>
        <div style={{ background: PARCHMENT, alignSelf: "stretch", borderRight: `1px solid ${BORDER}`, padding: "28px 14px", display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
            <div style={{ fontFamily: "Newsreader, serif", fontSize: 21, fontWeight: 600, color: INK }}>Welcome back, {greeting.firstName}</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>{greeting.dateEyebrow}</div>
          </div>
          <SidebarNav />
        </div>

        <div style={{ padding: "28px 32px 60px", display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
          <PulseStrip stats={pulseStats} />
          {children}
        </div>
      </div>
    </div>
  );
}
