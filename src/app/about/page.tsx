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
              Discover the mystical world of digital collectible cards on the Cronos blockchain
            </p>
          </div>
          
          {/* About section */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="order-2 md:order-1">
              <div className="modern-card p-6 h-full flex flex-col justify-center">
                <h2 className="text-2xl font-bold font-['Cinzel'] mb-4 text-[var(--secondary)]">Our Vision</h2>
                <p className="mb-4 text-white/80">
                  Cards of Cronos was born from a passion for collectibles and blockchain technology. We envisioned a platform where digital art meets utility, creating unique cards that hold both aesthetic and functional value.
                </p>
                <p className="mb-4 text-white/80">
                  Our mission is to bridge the gap between traditional collectible card games and the innovative world of blockchain, offering enthusiasts a new way to collect, trade, and engage with digital assets.
                </p>
                <p className="text-white/80">
                  Each card is meticulously designed and minted as a unique NFT on the Cronos blockchain, ensuring authenticity, provenance, and true ownership for collectors.
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
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="modern-card p-6 transition-transform hover:translate-y-[-5px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mb-4 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-['Cinzel'] mb-2 text-center text-[var(--secondary)]">True Ownership</h3>
                <p className="text-white/80 text-center">
                  Each card is a unique NFT on the Cronos blockchain, giving you true ownership that can be verified and transferred.
                </p>
              </div>
              
              {/* Feature 2 */}
              <div className="modern-card p-6 transition-transform hover:translate-y-[-5px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mb-4 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-['Cinzel'] mb-2 text-center text-[var(--secondary)]">Rarity System</h3>
                <p className="text-white/80 text-center">
                  Cards come in various rarity tiers, from common to mythical, each with unique attributes and visual effects.
                </p>
              </div>
              
              {/* Feature 3 */}
              <div className="modern-card p-6 transition-transform hover:translate-y-[-5px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center mb-4 mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-['Cinzel'] mb-2 text-center text-[var(--secondary)]">Trading Platform</h3>
                <p className="text-white/80 text-center">
                  Trade cards with other collectors in our secure marketplace, with full transparency and fair pricing.
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
              Ready to start your collection? Explore our card packs and join thousands of collectors in the Cards of Cronos universe.
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
