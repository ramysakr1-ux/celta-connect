import type { Metadata, Viewport } from "next";
import { Newsreader, Karla, Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

// Logo-only typefaces (Ramy's brand handoff) -- deliberately not the app's
// general font-serif/font-sans (Newsreader/Karla stay everywhere else).
// Scoped to the Wordmark component alone via these CSS variables so the
// mark is pixel-accurate to the handoff without re-typesetting the app.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Connect",
  description: "CELTA course administration, built for centers.",
  // specs/build-spec.md §7: iOS ignores manifest.ts's theme_color/display
  // for "Add to Home Screen" -- this is the separate metadata iOS actually
  // reads (apple-touch-icon comes from apple-icon.tsx automatically).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Connect",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3e2818",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${karla.variable} ${instrumentSerif.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <head>
        {/* Chrome fires beforeinstallprompt once, early in the load -- often
            before React has hydrated and the install pill has started
            listening. Missed, it is gone, and the pill can only show the
            gesture note. So it is caught here, before anything else loads,
            and the pill picks it up on mount (install-prompt.tsx). Ramy,
            17 Sep 2026: "I'm getting a tutorial instead of a home screen
            button." */}
        {/* And the service worker has to be REGISTERED for Chrome to fire that
            event at all: its install criteria want a service worker with a
            fetch handler, which is the only reason public/sw.js has one (see
            the comment there). It was registered nowhere but inside the push
            button — which renders on the student page and the staff chat
            drawer and nowhere else — so on the Command Center, the trainer
            hub, the centre console and the candidate's own rooms Chrome never
            fired beforeinstallprompt, and the pill could only ever open the
            gesture note. Ramy, 22 Sep 2026: "why can't I add the command
            center to the home screen." Registered for every page here, on
            load so it never competes with the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__connectInstallPrompt=e;});" +
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
