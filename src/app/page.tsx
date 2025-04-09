"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BurnCounter from '@/components/BurnCounter';
import CardForm from '@/components/CardForm';
import ScratchCard from '@/components/ScratchCard';
import BottomNavigation from '@/components/BottomNavigation';
import { initEmailJS } from '@/lib/email';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

export default function Home() {
  // Add isClient state to prevent hydration mismatch
  const [isClient, setIsClient] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [heroVisible, setHeroVisible] = useState<boolean>(false);
  const [burnVisible, setBurnVisible] = useState<boolean>(false);
  const heroRef = useRef<HTMLDivElement>(null);
  
  // Card pack images for hero section
  const cardPacks = [
    { name: 'Mythical Pack', color: 'from-[#FFD700] to-[#B14EFF]', image: '/sxfdO1IW9tFd2uK7oUg54HWLfM8.png' },
    { name: 'Rare Pack', color: 'from-[#3A0CA3] to-[#9D4EDD]', image: '/TS0ZEQa6LqHIwGwyQsgxIYJVPzc.jpeg' },
    { name: 'Epic Pack', color: 'from-[#F72585] to-[#3A0CA3]', image: '/E8okCphkavy5wOswGJQ1oyw07iI.png' }
  ];

  // Set isClient to true once component mounts on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize EmailJS - only run on client side after hydration
  useEffect(() => {
    if (!isClient) return;
    
    initEmailJS();
    setLoading(false);
    
    // Animate hero section
    const timer = setTimeout(() => {
      setHeroVisible(true);
    }, 300);
    
    // Animate burn counter with delay
    const burnTimer = setTimeout(() => {
      setBurnVisible(true);
    }, 800);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(burnTimer);
    };
  }, [isClient]);
  
  // Parallax effect for hero section - only run on client side after hydration
  useEffect(() => {
    if (!isClient || !heroRef.current) return;
    
    const handleScroll = () => {
      if (!heroRef.current) return;
      
      const scrollY = window.scrollY;
      const heroElement = heroRef.current;
      const isMobile = window.innerWidth < 768;
      
      // Apply parallax effect to hero background (reduced on mobile)
      heroElement.style.backgroundPositionY = `${
        scrollY * (isMobile ? 0.2 : 0.5)
      }px`;
      
      // Fade out hero content on scroll (adjusted for mobile)
      const opacity = Math.max(0, Math.min(1, 1 - scrollY / (isMobile ? 300 : 500)));
      const heroContent = heroElement.querySelector('.hero-content') as HTMLElement;
      if (heroContent) {
        heroContent.style.opacity = opacity.toString();
        heroContent.style.transform = `translateY(${scrollY * (isMobile ? 0.1 : 0.2)}px)`;
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isClient]);

  // Get the appKit and account directly
  const appKitAccount = useAppKitAccount();
  const { open } = useAppKit();  // Now properly wrapped in AppKit from context

  // Create refs for wallet state
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | undefined>(undefined);

  // Handle wallet connection
  const handleConnectWallet = () => {
    if (typeof window === 'undefined') return;
    
    try {
      // Open the AppKit modal
      open();
    } catch (error) {
      console.error('Error opening AppKit modal:', error);
    }
  };

  // Update wallet connection status
  useEffect(() => {
    if (!isClient) return;
    
    // Use the appKitAccount to check connection status
    setIsConnected(!!appKitAccount?.isConnected);
    setAddress(appKitAccount?.address);
    
  }, [isClient, appKitAccount]);

  return (
    <div className="min-h-screen">
      <Header 
        onConnectWallet={handleConnectWallet}
        isWalletConnected={isConnected}
        walletAddress={address}
      />
      
      {/* Hero Section */}
      <div 
        ref={heroRef}
        className="relative min-h-[80vh] md:min-h-[75vh] lg:min-h-[70vh] flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Pure black background */}
        <div className="absolute inset-0 bg-black"></div>
        
        {/* Subtle purple glow in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[80%] h-[80%] rounded-full bg-[var(--cosmic-purple)]/5 blur-[100px]"></div>
        </div>
        
        {/* Animated background cards */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Top left floating card */}
          <div className="absolute top-[10%] left-[10%] w-[15%] h-auto z-0 animate-float-slow transform rotate-[-8deg]">
            <div className="card-frame opacity-70">
              <ScratchCard 
                image="/0sXAL430bJImcrBP10AovPMtQU8-1.jpeg"
                name="PUUSH"
                color="from-[#F72585] to-[#B14EFF]"
                aspectRatio="aspect-[3/4]"
              />
            </div>
          </div>
          
          {/* Top right floating card */}
          <div className="absolute top-[15%] right-[12%] w-[14%] h-auto z-0 animate-float-medium transform rotate-[5deg]">
            <div className="card-frame opacity-70">
              <ScratchCard 
                image="/sxfdO1IW9tFd2uK7oUg54HWLfM8.png"
                name="CAW777"
                color="from-[#6A0DAD] to-[#9D4EDD]"
                aspectRatio="aspect-[3/4]"
              />
            </div>
          </div>
          
          {/* Bottom left floating card */}
          <div className="absolute bottom-[15%] left-[15%] w-[16%] h-auto z-0 animate-float-medium transform rotate-[3deg]">
            <div className="card-frame opacity-70">
              <ScratchCard 
                image="/BGOS4PVp4nxOsRhrupybTvvXMw.jpeg"
                name="CROOKS FINANCE"
                color="from-[#3A0CA3] to-[#4CC9F0]"
                aspectRatio="aspect-[3/4]"
              />
            </div>
          </div>
          
          {/* Bottom right floating card */}
          <div className="absolute bottom-[10%] right-[10%] w-[15%] h-auto z-0 animate-float-slow transform rotate-[-5deg]">
            <div className="card-frame opacity-70">
              <ScratchCard 
                image="/E8okCphkavy5wOswGJQ1oyw07iI.png"
                name="NODALIS"
                color="from-[#00F0FF] to-[#4CC9F0]"
                aspectRatio="aspect-[3/4]"
              />
            </div>
          </div>
          
          {/* Center background card */}
          <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[18%] h-auto z-0 animate-float-very-slow opacity-40 blur-[2px]">
            <div className="card-frame">
              <ScratchCard 
                image="/TS0ZEQa6LqHIwGwyQsgxIYJVPzc.jpeg"
                name="BABYAGENT"
                color="from-[#3A0CA3] to-[#9D4EDD]"
                aspectRatio="aspect-[3/4]"
              />
            </div>
          </div>
        </div>
        
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50 z-10"></div>
        
        {/* Mobile-specific adjustments for floating cards */}
        <style jsx>{`
          @media (max-width: 768px) {
            .card-frame {
              transform: scale(0.7);
            }
            
            div[class*="absolute top-[10%] left-[10%]"] {
              top: 15% !important;
              left: 5% !important;
              width: 25% !important;
            }
            
            div[class*="absolute top-[15%] right-[12%]"] {
              top: 15% !important;
              right: 5% !important;
              width: 25% !important;
            }
            
            div[class*="absolute bottom-[15%] left-[15%]"] {
              bottom: 20% !important;
              left: 5% !important;
              width: 25% !important;
            }
            
            div[class*="absolute bottom-[10%] right-[10%]"] {
              bottom: 20% !important;
              right: 5% !important;
              width: 25% !important;
            }
            
            div[class*="absolute top-[50%] left-[50%]"] {
              width: 30% !important;
            }
          }
        `}</style>
        
        {/* Main hero content */}
        <div
          className={`hero-content relative z-20 text-center transition-all duration-1000 max-w-5xl mx-auto px-4 mb-4 ${
            isClient && heroVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}
        >
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-['Cinzel'] mb-3 md:mb-4 tracking-wider text-[var(--secondary)]">
            CARDS OF CRONOS
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-white/90 font-['Spectral'] tracking-wide mb-4 md:mb-6 max-w-2xl mx-auto">
            Pick your type and rarity, burn tokens and get your own Cronos Card.
          </p>
          {/* CTA buttons */}
          <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-xs sm:max-w-2xl mx-auto">
            <a
              href="#card-form"
              className="modern-btn-secondary text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5"
            >
              CREATE CARD
            </a>
            <a
              href="/collection"
              className="modern-btn-secondary text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 bg-[var(--cosmic-purple)]/30"
            >
              VIEW COLLECTION
            </a>
          </div>
        </div>
      </div>
      
      {/* Burn Feature Section */}
      <div id="burn-section" className="py-6 md:py-16 px-3 md:px-4">
        <div
          className={`container mx-auto transition-all duration-1000 ${
            isClient && burnVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}
        >
          <div className="text-center mb-4 md:mb-10">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold font-['Cinzel'] mb-2 md:mb-4 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[var(--secondary)] to-[var(--secondary-glow)]">
              BURN TO EARN
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-white/80 font-['Spectral'] max-w-2xl mx-auto px-2">
              Contribute to the ecosystem by burning tokens. Track the community's progress and earn rewards.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <BurnCounter />
          </div>
          
          {/* Burn info cards */}
          <div className="mt-6 md:mt-10 text-center">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
              <div className="modern-card p-4 md:p-6 text-center">
                <div className="text-[var(--secondary)] text-2xl md:text-3xl mb-2 md:mb-3">🔥</div>
                <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 font-['Cinzel']">Burn Tokens</h3>
                <p className="text-xs md:text-sm text-white/70">
                  Burn your tokens to contribute to the ecosystem and reduce supply
                </p>
              </div>
              
              <div className="modern-card p-4 md:p-6 text-center">
                <div className="text-[var(--secondary)] text-2xl md:text-3xl mb-2 md:mb-3">✨</div>
                <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 font-['Cinzel']">Earn Rewards</h3>
                <p className="text-xs md:text-sm text-white/70">
                  Get exclusive rewards and NFTs based on your burn contribution
                </p>
              </div>
              
              <div className="modern-card p-4 md:p-6 text-center">
                <div className="text-[var(--secondary)] text-2xl md:text-3xl mb-2 md:mb-3">📈</div>
                <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 font-['Cinzel']">Track Progress</h3>
                <p className="text-xs md:text-sm text-white/70">
                  Monitor the community's burn progress and your contribution
                </p>
              </div>
            </div>
          </div>
          
          {/* Mobile CTA for burn section */}
          <div className="mt-6 md:mt-8 text-center">
            <a
              href="#card-form"
              className="modern-btn-primary text-xs sm:text-sm px-5 py-2 sm:py-2.5 mb-2 inline-block"
            >
              START BURNING
            </a>
          </div>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <BottomNavigation 
        isWalletConnected={isConnected}
        onConnectWallet={handleConnectWallet}
      />
      
      {/* Card Form Modal */}
      <div id="card-form" className="fixed inset-0 z-50 flex items-center justify-center hidden scroll-mt-24 target:flex">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => (window.location.hash = '')}
        ></div>
        <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-auto p-2 sm:p-4">
          <div className="modern-card modern-hexagon-bg p-3 sm:p-6">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-['Cinzel'] text-transparent bg-clip-text bg-gradient-to-r from-[var(--secondary)] to-[var(--secondary-glow)]">
                FORGE YOUR CARD
              </h2>
              <button
                onClick={() => (window.location.hash = '')}
                className="text-white/80 hover:text-white p-1 rounded-full bg-[var(--primary)]/20 hover:bg-[var(--primary)]/30"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <CardForm 
              isWalletConnected={isConnected}
              onConnectWallet={handleConnectWallet}
            />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}
