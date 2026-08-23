import type { Metadata } from "next";
import { Archivo_Black, JetBrains_Mono } from "next/font/google";

import { Footer } from "@/components/Footer";
import { CopycatWarning } from "@/components/CopycatWarning";
import { Nav } from "@/components/Nav";
import { RefCatcher } from "@/components/RefCatcher";

import "./globals.css";

// Two families that argue with each other: a heavy display for the headings and a
// mono for everything that is data. Without that contrast a screen reads as one
// long line — which was the problem with the previous version, where everything
// was mono.
const archivo = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  // Without this, the og:image on a shared link resolves against whatever host
  // happens to be building — localhost in dev, a preview URL on a branch — and
  // the card renders blank everywhere the link is actually pasted. The domain
  // is public, not a secret; the override exists so a preview deploy can point
  // at itself.
  // No domain yet, so the fallback is the dev server rather than a guess.
  // Set NEXT_PUBLIC_SITE_URL once there is one, or every link card pasted
  // anywhere renders against localhost and comes back blank.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Cards of Cronos",
  description:
    "A card game about Cronos. The projects you know, the tactics you use. Highest market cap wins.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body className="grid-lines flex min-h-screen flex-col">
        <CopycatWarning />
        <Nav />
        <RefCatcher />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
