'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNavigation from '@/components/BottomNavigation';
import { useAppKit, useAppKitAccount } from '@/lib/appkit';

export default function AboutPage() {
  const [pageLoaded, setPageLoaded] = useState(false);
  
  // Get wallet connection status from AppKit
  const { isConnected, address } = useAppKitAccount();
  const { open } = useAppKit();

  // Handle wallet connection
  const handleConnectWallet = () => {
    open();
  };
  
  // Animation on page load
  useEffect(() => {
    setPageLoaded(true);
  }, []);
  
  return (
    <div className="min-h-screen">
      <Header 
        onConnectWallet={handleConnectWallet}
        isWalletConnected={isConnected}
        walletAddress={address}
      />
      
      {/* Page content */}
      <main className="relative pt-24 pb-32">
        {/* Background elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--cosmic-black)] via-[var(--cosmic-purple)]/10 to-[var(--cosmic-black)] -z-10"></div>
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-5 -z-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5.61L7.5 18.8v24.38L30 56.39l22.5-13.2V18.8L30 5.61zm0 2.8l20 11.74v20.52L30 51.8l-20-11.74V20.15L30 8.4z' fill='%239D4EDD' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px'
          }}
        ></div>
        
        {/* Content container */}
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 transition-all duration-1000 ${pageLoaded ? 'opacity-100' : 'opacity-0 translate-y-10'}`}>
          {/* Page header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-['Cinzel'] mb-4 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
              ABOUT CARDS OF CRONOS
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] mx-auto mb-6"></div>
            <p className="text-lg text-white/80 font-['Spectral'] max-w-3xl mx-auto">
              Discover the mystical world of digital collectible cards powered by the Cronos blockchain
            </p>
          </div>
          
          {/* About section */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="order-2 md:order-1">
              <div className="modern-card p-6 h-full flex flex-col justify-center">
                <h2 className="text-2xl font-bold font-['Cinzel'] mb-4 text-[var(--secondary)]">Our Vision</h2>
                <p className="mb-4 text-white/80">
                  Welcome to Cards of Cronos — the premier collectible card platform on the Cronos blockchain. We're creating a unique ecosystem where art, utility, and community converge. Each card represents more than just digital art; it's a symbol of identity, community membership, and blockchain legacy.
                </p>
                <p className="mb-4 text-white/80">
                  Our deflationary model is simple yet powerful: you burn tokens, we create unique cards. With every creation, the token supply decreases and the value of the ecosystem grows. Your participation directly shapes the future of the platform and secures your place in the Cards of Cronos story.
                </p>
                <p className="text-white/80">
                  Whether you're a project founder, community member, or collector, Cards of Cronos offers a way to immortalize your presence in the Cronos ecosystem. Pick your card type, choose your rarity, and forge your destiny in this evolving digital universe.
                </p>
              </div>
            </div>
          <div className="order-1 md:order-2 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md perspective-1000">
              <div className="card-3d preserve-3d rounded-xl overflow-hidden shadow-2xl transition-all duration-500 hover:shadow-[0_0_30px_rgba(157,78,221,0.6)]">
                <div className="relative">
                  <Image 
                    src="/sxfdO1IW9tFd2uK7oUg54HWLfM8.png"
                    alt="Cards of Cronos Vision"
                    width={500}
                    height={500}
                    className="rounded-lg object-contain w-full"
                    style={{ maxHeight: '450px' }}
                  />
                  <div className="absolute inset-0 rounded-lg border border-white/30 shadow-inner"></div>
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 to-transparent opacity-60"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--cosmic-black)]/80 via-transparent to-transparent opacity-40"></div>
                </div>
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-[var(--primary-glow)]/20 to-[var(--secondary)]/20 rounded-xl blur-xl opacity-70 -z-10 animate-pulse-subtle"></div>
            </div>
          </div>
          </div>
          
          {/* Features section */}
          <div className="mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold font-['Cinzel'] mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
              FEATURES & BENEFITS
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Burn Supply */}
              <div className="modern-card p-6 transition-transform hover:translate-y-[-5px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mb-4 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-['Cinzel'] mb-2 text-center text-[var(--secondary)]">BURN SUPPLY</h3>
                <p className="text-white/80 text-center">
                  Each card created permanently burns tokens from circulation, reducing total supply and potentially increasing value for all holders. Our deflationary mechanism ensures long-term sustainability.
                </p>
              </div>
              
              {/* Rarity Levels */}
              <div className="modern-card p-6 transition-transform hover:translate-y-[-5px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mb-4 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-['Cinzel'] mb-2 text-center text-[var(--secondary)]">CHOOSE RARITY LEVEL</h3>
                <div className="text-white/80 text-center">
                  <p className="mb-2">⚪ Common (10k 🔥)</p>
                  <p className="mb-2">🟨 Rare (20k 🔥)</p>
                  <p className="mb-2">🟪 Epic (50k 🔥)</p>
                  <p className="mb-2">🟧 Legendary (100k 🔥)</p>
                  <p>⚫ Mythical (250k 🔥)</p>
                </div>
              </div>
              
              {/* Bringing Projects Together */}
              <div className="modern-card p-6 transition-transform hover:translate-y-[-5px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mb-4 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-['Cinzel'] mb-2 text-center text-[var(--secondary)]">BRINGING PROJECTS TOGETHER</h3>
                <p className="text-white/80 text-center">
                  Cards of Cronos serves as a unifying platform for projects across the Cronos ecosystem. We showcase and celebrate diverse projects, founders, and communities through beautiful, collectible cards.
                </p>
              </div>
              
              {/* Join Cronos Card */}
              <div className="modern-card p-6 transition-transform hover:translate-y-[-5px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mb-4 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-['Cinzel'] mb-2 text-center text-[var(--secondary)]">JOIN CRONOS CARD</h3>
                <p className="text-white/80 text-center">
                  Create your personalized card today and become part of the Cards of Cronos universe. Whether representing your project, community, or personal brand, your card becomes a permanent part of the collection.
                </p>
              </div>
            </div>
          </div>
          
          {/* CTA section */}
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold font-['Cinzel'] mb-6 text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-glow)] to-[var(--secondary)]">
              JOIN THE COMMUNITY
            </h2>
            <p className="text-lg text-white/80 font-['Spectral'] max-w-3xl mx-auto mb-8">
              Ready to immortalize your presence on the Cronos blockchain? Create your custom card, contribute to token burning, and join our growing community of collectors and creators.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/collection" 
                className="modern-btn-primary text-sm w-full sm:w-auto px-8 py-3"
              >
                View Collection
              </Link>
              <Link 
                href="/" 
                className="modern-btn-secondary text-sm w-full sm:w-auto px-8 py-3"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation */}
      <BottomNavigation 
        isWalletConnected={isConnected}
        onConnectWallet={handleConnectWallet}
      />
      
      <Footer />
    </div>
  );
}
