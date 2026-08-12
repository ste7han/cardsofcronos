'use client';
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useAppKit } from '@/hooks/useAppKit';

export default function ArenaMenu() {
  // Stond hardcoded op "niet verbonden" met een lege connect-handler, waardoor
  // de knop in de header op deze pagina niets deed.
  const { appKitAccount, openAppKit } = useAppKit();
  const address = appKitAccount?.address;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Spectral']">
      <Header isWalletConnected={!!address} walletAddress={address} onConnectWallet={openAppKit} />
      <main className="container mx-auto px-4 py-20">
         <div className="flex flex-col items-center justify-center animate-in fade-in duration-700">
             <h1 className="text-6xl md:text-8xl font-['Cinzel'] mb-12 text-center tracking-widest uppercase italic drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
               The Arena
             </h1>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
                
                {/* LINK NAAR TRAINING */}
                <Link href="/arena/training" className="group cursor-pointer relative h-[300px] bg-black/40 border border-white/10 rounded-[3rem] p-8 flex flex-col items-center justify-center hover:bg-black/60 transition-all hover:scale-[1.02]">
                   <div className="absolute inset-0 bg-blue-500/5 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <h2 className="text-3xl font-black font-['Cinzel'] text-blue-400 mb-4 uppercase">Training Simulation</h2>
                   <p className="text-gray-400 text-center mb-6 text-sm">Test strategies against the AI.<br/>Access to ALL cards.</p>
                   <span className="px-6 py-2 bg-blue-900/30 border border-blue-500/30 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-300">Free Mode</span>
                </Link>

                {/* LINK NAAR PVP (NU ACTIEF!) */}
                <Link href="/arena/pvp" className="group cursor-pointer relative h-[300px] bg-black/40 border border-white/10 rounded-[3rem] p-8 flex flex-col items-center justify-center hover:bg-black/60 transition-all hover:scale-[1.02] border-amber-500/20 hover:border-amber-500/50">
                   <div className="absolute inset-0 bg-amber-500/5 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <h2 className="text-3xl font-black font-['Cinzel'] text-amber-500 mb-4 uppercase">Live Combat</h2>
                   <p className="text-gray-400 text-center mb-6 text-sm">Play your own NFTs against another player.<br/>Friendly match — no tokens at stake.</p>
                   <span className="px-6 py-2 bg-amber-900/30 border border-amber-500/30 rounded-full text-[10px] font-bold uppercase tracking-widest text-amber-300">Enter Lobby</span>
                </Link>

             </div>
          </div>
      </main>
      <Footer />
    </div>
  );
}