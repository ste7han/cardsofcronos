import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Inter, Spectral } from "next/font/google";
import "../styles/modern-theme.css";
import StaticBackground from "@/components/StaticBackground";
import LoadingScreen from "@/components/LoadingScreen";
import { AppKit } from "@/context/appkit";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spectral = Spectral({
  subsets: ["latin"],
  variable: "--font-spectral",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Cards of Cronos | Forge Your Destiny",
  description: "The ultimate fantasy card collection for the Cronos blockchain. Collect, trade, and forge your destiny in the cosmic realm.",
  keywords: ["Cronos", "NFT", "Cards", "Blockchain", "Fantasy", "Collectibles"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${spectral.variable} antialiased`}
      >
        {/* Static modern background */}
        <StaticBackground />
        
        {/* Modern Loading Screen Component */}
        <LoadingScreen timeout={2500} />
        
        <div className="relative z-10">
          <AppKit>
            {children}
          </AppKit>
        </div>
        
      </body>
    </html>
  );
}
