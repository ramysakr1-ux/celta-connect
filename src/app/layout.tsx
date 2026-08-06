import type { Metadata } from "next";
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
  title: "Connect CELTA",
  description: "CELTA course administration, built for centers.",
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
      <body className="min-h-full flex flex-col bg-background text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
