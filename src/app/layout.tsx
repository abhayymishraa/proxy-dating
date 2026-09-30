import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Proxy — your agent dates for you",
  description: "Paste a LinkedIn and a public Instagram. An AI agent reads the person, goes on dates with other agents on their behalf, and ranks who fits best.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrument.variable} ${newsreader.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-screen">
        <header className="border-b rule">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-baseline justify-between gap-4">
            <Link href="/" className="display text-3xl sm:text-4xl">Proxy<span className="text-wine">.</span></Link>
            <nav className="kicker flex gap-4 sm:gap-6">
              <Link href="/#people" className="hover:text-wine">People</Link>
              <Link href="/dates" className="hover:text-wine">Dates</Link>
              <Link href="/rankings" className="hover:text-wine">Rankings</Link>
              <Link href="/how" className="hover:text-wine">How it works</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">{children}</main>
      </body>
    </html>
  );
}
